import { env } from "$env/dynamic/private"
import type { StoreLanguage, StoreSearchInfo, VectorMatch } from "$lib/ragservice/types"
import { getUserGroups } from "$lib/server/auth/get-user-groups"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import { getRagToken } from "./get-rag-token"

const USE_MULTISEARCH: boolean = true

type RagAuth = {
	ragToken: string
	userId: string
	groups: string[]
}

async function resolveRagAuth(user: AuthenticatedPrincipal | null, graphToken: string | null): Promise<RagAuth> {
	if (env.MOCK_AUTH === "true") {
		if (!env.RAGSERVICE_TOKEN) throw new Error("RAGSERVICE_TOKEN er ikke satt i .env for lokal utvikling")
		return {
			ragToken: env.RAGSERVICE_TOKEN,
			userId: user?.userId ?? "mock-user",
			groups: user?.groups ?? []
		}
	}

	if (!user) throw new Error("Manglende brukeridentitet for RAG-søk")
	return {
		ragToken: await getRagToken(),
		userId: user.userId,
		groups: await getUserGroups(user, graphToken)
	}
}

async function fetchStoreSearch(storeId: string, query: string, ragToken: string, userId: string, groups: string[]): Promise<VectorMatch[]> {
	const res = await fetch(`${env.RAGSERVICE_URL}/api/stores/${storeId}/search/text`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${ragToken}`,
			"content-type": "application/json",
			"x-user-id": userId,
			"x-user-groups": groups.join(",")
		},
		body: JSON.stringify({
			text: query,
			replyLimit: 3
		})
	})
	if (!res.ok) return []
	return (await res.json()) as VectorMatch[]
}

async function fetchMultiStoreSearch(storeIds: string[], query: string, ragToken: string, userId: string, groups: string[]): Promise<VectorMatch[]> {
	const res = await fetch(`${env.RAGSERVICE_URL}/api/search/`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${ragToken}`,
			"content-type": "application/json",
			"x-user-id": userId,
			"x-user-groups": groups.join(",")
		},
		body: JSON.stringify({
			storeIds: storeIds,
			text: query,
			replyLimit: 3
		})
	})
	if (!res.ok) return []
	return (await res.json()) as VectorMatch[]
}

export async function searchRagStores(storeIds: string[], query: string, user: AuthenticatedPrincipal | null, graphToken: string | null): Promise<VectorMatch[]> {
	if (storeIds.length === 0) return []

	const { ragToken, userId, groups } = await resolveRagAuth(user, graphToken)

	// Try use ragservice buildting multiserach
	if (USE_MULTISEARCH) {
		const results = await fetchMultiStoreSearch(storeIds, query, ragToken, userId, groups)
		return results
	}

	// Handle multiserach manually with promise all
	else {
		const results = await Promise.all(storeIds.map((id) => fetchStoreSearch(id, query, ragToken, userId, groups)))
		return results.flat()
	}
}

async function fetchStoreSearchInfo(storeId: string, ragToken: string, userId: string, groups: string[]): Promise<StoreSearchInfo | null> {
	try {
		const res = await fetch(`${env.RAGSERVICE_URL}/api/stores/${storeId}/searchinfo`, {
			headers: {
				authorization: `Bearer ${ragToken}`,
				"x-user-id": userId,
				"x-user-groups": groups.join(",")
			}
		})
		if (!res.ok) return null
		return (await res.json()) as StoreSearchInfo
	} catch {
		return null
	}
}

export type RagStoreLanguages = {
	storeId: string
	languages: StoreLanguage[]
}

// Best-effort lookup of the language mix ragservice has detected across a store's files, used to
// steer query rewriting toward the language the underlying documents are actually written in.
// This hits the search-scoped /searchinfo endpoint (not the full store object), so it only needs
// search access. Never throws - a store that can't be reached just contributes no language signal.
export async function getRagStoreLanguages(storeIds: string[], user: AuthenticatedPrincipal | null, graphToken: string | null): Promise<RagStoreLanguages[]> {
	if (storeIds.length === 0) return []

	const { ragToken, userId, groups } = await resolveRagAuth(user, graphToken)

	return await Promise.all(
		storeIds.map(async (storeId) => ({
			storeId,
			languages: (await fetchStoreSearchInfo(storeId, ragToken, userId, groups))?.languages ?? []
		}))
	)
}
