import { env } from "$env/dynamic/private"
import type { DBAgent } from "$lib/types/agents.js"
import type { DBConversation } from "$lib/types/conversation.js"
import type { VectorChunk } from "$lib/types/vector.js";

export const getMockDb = async (): Promise<{ agents: DBAgent[]; conversations: DBConversation[]; vectors: Record<string, VectorChunk[]>}> => {
	const mockDbData = await import("./mockdb-data.js")
	const mockTestDbData = await import("./mockdb-test-data.js")

	console.log("./db/mockdb-data.js exists, loaded mockdb, returning mock collections")
	return env.TEST_MODE === "true" ? mockTestDbData : mockDbData
}
