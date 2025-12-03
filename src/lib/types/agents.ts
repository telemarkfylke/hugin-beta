// AGENT CONFIG TYPES
// MOCK

import z from "zod"
import type { Conversation } from "./conversation"
import type { AgentPrompt, Message } from "./message"
import type { GetVectorStoreFilesResult } from "./requests"

export const BaseConfig = z.object({
	vectorStoreEnabled: z.boolean().default(false).optional(),
	messageFilesEnabled: z.boolean().default(false).optional(),
	webSearchEnabled: z.boolean().default(false).optional()
})

export const MockAgentConfig = BaseConfig.extend({
	type: z.literal("mock-agent"), // discriminator
	instructions: z.string().nullable(),
	vectorStoreIds: z.array(z.string()).nullable().optional()
})

export type MockAgentConfig = z.infer<typeof MockAgentConfig>

// MISTRAL
export const MistralConversationConfig = BaseConfig.extend({
	type: z.literal("mistral-conversation"), // discriminator
	model: z.enum(["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest", "pixtral-large-2411"]), // add models we want to support here
	instructions: z.string().nullable(),
	documentLibraryIds: z.array(z.string()).nullable().optional()
})

export type MistralConversationConfig = z.infer<typeof MistralConversationConfig>

export const MistralAgentConfig = BaseConfig.extend({
	type: z.literal("mistral-agent"), // discriminator
	agentId: z.string()
})

export type MistralAgentConfig = z.infer<typeof MistralAgentConfig>

export const OllamaAIResponseConfig = BaseConfig.extend({
	type: z.literal("ollama-response"), // discriminator
	model: z.enum(["gemma3"]), // add models we want to support here
	instructions: z.string().nullable(),
	vectorStoreIds: z.array(z.string()).nullable().optional()
})

export type OllamaAIResponseConfig = z.infer<typeof OllamaAIResponseConfig>

/**
 * OpenAI Response Config
 * Used for agents that respond directly using OpenAI models
 */
export const OpenAIAResponseConfig = BaseConfig.extend({
	type: z.literal("openai-response"), // discriminator
	model: z.enum(["gpt-4o"]), // add models we want to support here
	instructions: z.string().nullable(),
	vectorStoreIds: z.array(z.string()).nullable().optional()
})

export type OpenAIAResponseConfig = z.infer<typeof OpenAIAResponseConfig>

/**
 * OpenAI Prompt Config
 * Used for agents that use predefined prompts/templates
 */
export const OpenAIPromptConfig = BaseConfig.extend({
	type: z.literal("openai-prompt"), // discriminator
	prompt: z.object({
		id: z.string(),
		version: z.string().optional()
	})
})

export type OpenAIPromptConfig = z.infer<typeof OpenAIPromptConfig>

// AGENT UNION TYPE
export const AgentConfig = z.discriminatedUnion("type", [MockAgentConfig, MistralConversationConfig, MistralAgentConfig, OpenAIAResponseConfig, OpenAIPromptConfig, OllamaAIResponseConfig])

export type AgentConfig = z.infer<typeof AgentConfig>

// DB AGENT AND CONVERSATION TYPES
export const DBAgent = z.object({
	_id: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	config: AgentConfig
})

export type DBAgent = z.infer<typeof DBAgent>

// ZOD v4 has mime, but we are on v3 for now, wait a week or so until super-stable
const MimeType = z.string()

// FULL AGENT TYPE
export const Agent = DBAgent.extend({
	allowedMimeTypes: z.object({
		messageImages: z.array(MimeType),
		messageFiles: z.array(MimeType),
		vectorStoreFiles: z.array(MimeType)
	})
})

export type Agent = z.infer<typeof Agent>

// RESULT TYPES
export type CreateConversationResult = {
	relatedConversationId: string
	vectorStoreId: string | null
	response: ReadableStream<Uint8Array>
}

export type AppendToConversationResult = {
	response: ReadableStream<Uint8Array>
}

export type AddConversationFilesResult = {
	response: ReadableStream<Uint8Array>
}

export type GetConversationMessagesResult = {
	messages: Message[] // Legg inn riktig type senere (er ikke dette riktig da?)
}

export type GetConversationVectorStoreFileContentResult = {
	redirectUrl?: string
	content?: Response
}

// AGENT INTERFACE
export interface IAgent {
	getAgentInfo: () => Agent
	createConversation: (conversation: Conversation, initialPrompt: AgentPrompt, streamResponse: boolean) => Promise<CreateConversationResult>
	appendMessageToConversation: (conversation: Conversation, prompt: AgentPrompt, streamResponse: boolean) => Promise<AppendToConversationResult>
	addConversationVectorStoreFiles: (conversation: Conversation, files: File[], streamResponse: boolean) => Promise<AddConversationFilesResult>
	getConversationVectorStoreFiles: (conversation: Conversation) => Promise<GetVectorStoreFilesResult>
	getConversationVectorStoreFileContent: (conversation: Conversation, fileId: string) => Promise<GetConversationVectorStoreFileContentResult>
	deleteConversationVectorStoreFile: (conversation: Conversation, fileId: string) => Promise<void>
	getConversationMessages: (conversation: Conversation) => Promise<GetConversationMessagesResult>
}
