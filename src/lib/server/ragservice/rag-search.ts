import { env } from "$env/dynamic/private"
import type { VectorMatch } from "$lib/ragservice/types"
import { getUserGroups } from "$lib/server/auth/get-user-groups"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import { getRagToken } from "./get-rag-token"

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
			replyLimit: 5,
			weights: { text: 0.5, vector: 0.5 }
		})
	})
	if (!res.ok) return []
	return (await res.json()) as VectorMatch[]
}

export async function searchRagStores(storeIds: string[], query: string, user: AuthenticatedPrincipal | null, graphToken: string | null): Promise<VectorMatch[]> {
	if (storeIds.length === 0) return []

	let ragToken: string
	let userId: string
	let groups: string[]

	if (env.MOCK_AUTH === "true") {
		if (!env.RAGSERVICE_TOKEN) throw new Error("RAGSERVICE_TOKEN er ikke satt i .env for lokal utvikling")
		ragToken = env.RAGSERVICE_TOKEN
		userId = user?.userId ?? "mock-user"
		groups = user?.groups ?? []
	} else {
		if (!user) throw new Error("Manglende brukeridentitet for RAG-søk")
		ragToken = await getRagToken()
		userId = user.userId
		groups = await getUserGroups(user, graphToken)
	}

	const results = await Promise.all(storeIds.map((id) => fetchStoreSearch(id, query, ragToken, userId, groups)))
	return results.flat()
}
