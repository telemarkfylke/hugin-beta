import { env } from "$env/dynamic/private"
import { getRagToken } from "./get-rag-token"
import type { VectorMatch } from "$lib/ragservice/types"

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

export async function searchRagStores(
	storeIds: string[],
	query: string,
	userToken: string | null
): Promise<VectorMatch[]> {
	if (storeIds.length === 0) return []

	let ragToken: string
	if (env.MOCK_AUTH === "true") {
		if (!env.RAGSERVICE_TOKEN) throw new Error("RAGSERVICE_TOKEN er ikke satt i .env for lokal utvikling")
		ragToken = env.RAGSERVICE_TOKEN
	} else {
		if (!userToken) throw new Error("Manglende brukertoken for RAG-søk")
		ragToken = await getRagToken(userToken)
	}

	const results = await Promise.all(storeIds.map(id => fetchStoreSearch(id, query, ragToken)))
	return results.flat()
}
