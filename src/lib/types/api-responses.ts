import z from "zod"
import { Agent, DBAgent } from "./agents.js"
import { DBConversation, VendorConversation } from "./conversation.js"
import { Message } from "./message.js"
import { VectorStore, VectorStoreFile } from "./vector-store.js"

// api/agents
export const GetAgentsResponse = z.object({
	agents: z.array(DBAgent)
})

export type GetAgentsResponse = z.infer<typeof GetAgentsResponse>

export const PostAgentResponse = z.object({
	agent: DBAgent
})

export type PostAgentResponse = z.infer<typeof PostAgentResponse>

// api/agents/[agentId]
export const GetAgentResponse = z.object({
	agent: Agent
})

export type GetAgentResponse = z.infer<typeof GetAgentResponse>

// api/agents/[agentId]/conversations
export const GetAgentConversationsResponse = z.object({
	conversations: z.array(DBConversation)
})

export type GetAgentConversationsResponse = z.infer<typeof GetAgentConversationsResponse>

// api/agents/[agentId]/conversations/[conversationId]
export const GetAgentConversationResponse = z.object({
	conversation: DBConversation,
	items: z.array(Message)
})

export type GetAgentConversationResponse = z.infer<typeof GetAgentConversationResponse>

// api/agents/[agentId]/conversations/[conversationId]/vectorstorefiles
export const GetAgentConversationVectorstoreFilesResponse = z.object({
	files: z.array(VectorStoreFile)
})

export type GetAgentConversationVectorstoreFilesResponse = z.infer<typeof GetAgentConversationVectorstoreFilesResponse>

// api/conversations
export const GetConversationsResponse = z.object({
	conversations: z.array(DBConversation)
})

export type GetConversationsResponse = z.infer<typeof GetConversationsResponse>

// api/vectorstores
export const GetVectorStoresResponse = z.object({
	vectorstores: z.array(VectorStore)
})

export type GetVectorStoresResponse = z.infer<typeof GetVectorStoresResponse>

export const PostVectorStoresResponse = z.object(VectorStore)

export type PostVectorStoresResponse = z.infer<typeof PostVectorStoresResponse>

// api/vectorstores/[vendorId]/[vectorstoreId]
export const GetVendorVectorStoreResponse = z.object({
	vectorStore: VectorStore
})

export type GetVendorVectorStoreResponse = z.infer<typeof GetVendorVectorStoreResponse>

// api/vectorstores/[vendorId]/[vectorstoreId]/vectorstorefiles
export const GetVendorVectorStoreFilesResponse = z.object({
	files: z.array(VectorStoreFile)
})

export type GetVendorVectorStoreFilesResponse = z.infer<typeof GetVendorVectorStoreFilesResponse>

// api/vendorconversations
export const GetVendorConversationsResponse = z.object({
	vendorConversations: z.array(VendorConversation)
})

export type GetVendorConversationsResponse = z.infer<typeof GetVendorConversationsResponse>
