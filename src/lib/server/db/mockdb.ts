import { env } from "$env/dynamic/private"
import type { DBAgent } from "$lib/types/agents.js"
import type { DBConversation } from "$lib/types/conversation.js"

export const getMockDb = async (): Promise<{ agents: DBAgent[]; conversations: DBConversation[] }> => {
	// We add the mock agent here so it is always present in the mock db
	const mockDbDataFile = env.TEST_MODE === "true" ? "./mockdb-test-data.js" : "./mockdb-data.js"
	const { agents, conversations } = await import(mockDbDataFile)
	console.log("./db/mockdb-data.js exists, loaded mockdb, returning mock collections")
	return { agents, conversations }
}
