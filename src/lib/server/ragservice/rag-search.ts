import { env } from "$env/dynamic/private"
import type { VectorMatch } from "$lib/ragservice/types"
import { getRagToken } from "./get-rag-token"

async function fetchStoreSearch(storeId: string, query: string, ragToken: string): Promise<VectorMatch[]> {
	const res = await fetch(`${env.RAGSERVICE_URL}/api/stores/${storeId}/search/text`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${ragToken}`,
			"content-type": "application/json"
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

export async function searchRagStores(storeIds: string[], query: string, refreshToken: string | null): Promise<VectorMatch[]> {
	if (storeIds.length === 0) return []

	let ragToken: string
	if (env.MOCK_AUTH === "true") {
		if (!env.RAGSERVICE_TOKEN) throw new Error("RAGSERVICE_TOKEN er ikke satt i .env for lokal utvikling")
		ragToken = env.RAGSERVICE_TOKEN
	} else {
		if (!refreshToken) throw new Error("Manglende refresh token for RAG-søk")
		ragToken = await getRagToken(refreshToken)
	}

	const results = await Promise.all(storeIds.map((id) => fetchStoreSearch(id, query, ragToken)))
	return results.flat()
}
