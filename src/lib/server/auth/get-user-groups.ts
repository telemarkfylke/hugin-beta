import type { AuthenticatedPrincipal } from "$lib/types/authentication"

const TTL_MS = 5 * 60 * 1000

const groupsCache = new Map<string, { groups: string[]; expiresAt: number }>()

export async function getUserGroups(principal: AuthenticatedPrincipal, graphToken: string | null): Promise<string[]> {
	if (principal.groups.length > 0) return principal.groups
	if (!graphToken) return []

	const now = Date.now()
	const cached = groupsCache.get(principal.userId)
	if (cached && cached.expiresAt > now) return cached.groups

	const res = await fetch("https://graph.microsoft.com/v1.0/me/memberOf/microsoft.graph.group?$select=id", {
		headers: { authorization: `Bearer ${graphToken}` }
	})
	if (!res.ok) return []

	const data = await res.json()
	const groups: string[] = (data.value as { id: string }[]).map((g) => g.id)

	groupsCache.set(principal.userId, { groups, expiresAt: now + TTL_MS })
	return groups
}
