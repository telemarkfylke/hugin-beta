import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"

//Ad hoc-ish Group blocking for Nettsperre groups
// BLOCKED_GROUPS: comma-separated Entra group object ids, case-insensitive. Members are locked out (403).
// The groups are typically unrelated to Hugin and therefore not in the EasyAuth `groups` claim, so membership is
// looked up in Microsoft Graph (checkMemberGroups, max 20 ids) with the app's OWN token (client credentials, same app registration as
// ENTRA_CLIENT_ID), not the user's. That app registration needs the application permissions User.ReadBasic.All and GroupMember.Read.All
// (admin consent). Fails OPEN (user is let through) if the lookup is not possible.
const TTL_MS = 5 * 60 * 1000 //5 minute cache TTL
const TOKEN_EXPIRY_MARGIN_MS = 60 * 1000

const blockedCache = new Map<string, { blocked: boolean; expiresAt: number }>()
let graphAppToken: { value: string; expiresAt: number } | null = null

const getBlockedGroups = (): string[] =>
	(env.BLOCKED_GROUPS ?? "")
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean)

/** The app's own Graph token (client credentials), reused until shortly before it expires. Throws if it can't be fetched. */
const getGraphAppToken = async (): Promise<string> => {
	const now = Date.now()
	if (graphAppToken && graphAppToken.expiresAt - TOKEN_EXPIRY_MARGIN_MS > now) return graphAppToken.value

	const res = await fetch(`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/token`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "client_credentials",
			client_id: env.ENTRA_CLIENT_ID ?? "",
			client_secret: env.ENTRA_CLIENT_SECRET ?? "",
			scope: "https://graph.microsoft.com/.default"
		})
	})
	if (!res.ok) {
		throw new Error(`Could not get Graph app token, status ${res.status}`)
	}
	const data = (await res.json()) as { access_token: string; expires_in: number }
	graphAppToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 }
	return data.access_token
}

/** Throws if Graph can't answer, so the caller can fail open without caching the failure. */
const isMemberOfAny = async (userId: string, groupIds: string[]): Promise<boolean> => {
	const token = await getGraphAppToken()
	const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/checkMemberGroups`, {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify({ groupIds })
	})
	if (!res.ok) {
		throw new Error(`Graph checkMemberGroups failed with status ${res.status}`)
	}
	const data = (await res.json()) as { value: string[] }
	return data.value.length > 0
}

export const isUserInBlockedGroup = async (principal: AuthenticatedPrincipal): Promise<boolean> => {
	const blockedGroups = getBlockedGroups()
	if (blockedGroups.length === 0) return false

	if (principal.groups.some((group) => blockedGroups.includes(group.toLowerCase()))) return true

	const now = Date.now()
	const cached = blockedCache.get(principal.userId)
	if (cached && cached.expiresAt > now) return cached.blocked

	try {
		const blocked = await isMemberOfAny(principal.userId, blockedGroups)
		blockedCache.set(principal.userId, { blocked, expiresAt: now + TTL_MS })
		return blocked
	} catch (error) {
		logger.errorException(error, "Could not check BLOCKED_GROUPS membership for user {userId} - letting them through", principal.userId)
		return false
	}
}
