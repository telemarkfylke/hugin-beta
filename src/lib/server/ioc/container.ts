import { env } from "$env/dynamic/private"
import type { IAgentStore } from "../db/agents/interface.js"
import { MockAgentStore } from "../db/agents/mock_agentstore.js"
import { MongoAgentStore } from "../db/agents/mongo_agentstore.js"
import type { IConversationStore } from "../db/conversations/interface"
import { MockConversationStore } from "../db/conversations/mock_conversationstore"
import { MongoConversationStore } from "../db/conversations/mongo_conversationstore.js"
import { agents as mockAgents, conversations as mockConversations } from "../db/mockdb-data.js"
import { agents as testAgents, conversations as testConversations } from "../db/mockdb-test-data.js"
import type { IVectorStoreDb } from "../db/vectorstore/interface"
import { MockVectorStoreDb } from "../db/vectorstore/mock_vectorstore"
import { MongoVectorStoreDb } from "../db/vectorstore/mongodb_vectorstore"
import type { IEmbedder } from "../embeddings/interface"
import { MockEmbedder } from "../embeddings/mock_embedder"
import { OllamaEmbedder } from "../embeddings/ollama_embedder"

export type IocContainer = {
	vectorStore: IVectorStoreDb
	embedder: IEmbedder
	conversationStore: IConversationStore
	agentStore: IAgentStore
}

let iocContainer: IocContainer

export function getIocContainer(): IocContainer {
	if (!iocContainer) {
		iocContainer = {
			vectorStore: env.MOCK_VECTORSTORE === "true" ? new MockVectorStoreDb() : new MongoVectorStoreDb(),
			embedder: env.MOCK_EMBEDDER === "true" ? new MockEmbedder() : new OllamaEmbedder(),
			conversationStore: env.MOCK_DB === "true" ? new MockConversationStore(env.TEST_MODE === "true" ? testConversations : mockConversations) : new MongoConversationStore(),
			agentStore: env.MOCK_DB === "true" ? new MockAgentStore(env.TEST_MODE === "true" ? testAgents : mockAgents) : new MongoAgentStore()
		}
	}

	return iocContainer
}

export function setIocContainer(container: IocContainer) {
	iocContainer = container
}
