import z from "zod"
import type { DBConversation } from "./conversation"
import type { AgentPrompt, Message } from "./message"
import { SupportedVendorIds } from "./vendor-ids"
import type { IVendorResults } from "./vendors"

const BaseConfig = z.object({
	vectorStoreEnabled: z.boolean().default(false).optional(),
	messageFilesEnabled: z.boolean().default(false).optional(),
	webSearchEnabled: z.boolean().default(false).optional()
})

const MockAgentConfig = BaseConfig.extend({
	type: z.literal("mock-agent"), // discriminator
	instructions: z.string().nullable(),
	vectorStoreIds: z.array(z.string()).nullable().optional()
})

// MISTRAL
const MistralConversationConfig = BaseConfig.extend({
	type: z.literal("mistral-conversation"), // discriminator
	model: z.enum(["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest", "pixtral-large-2411", "mistral-large-2512"]), // add models we want to support here
	instructions: z.string().nullable(),
	documentLibraryIds: z.array(z.string()).nullable().optional()
})

const MistralAgentConfig = BaseConfig.extend({
	type: z.literal("mistral-agent"), // discriminator
	agentId: z.string()
})

// OLLAMA
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
const OpenAIAResponseConfig = BaseConfig.extend({
	type: z.literal("openai-response"), // discriminator
	model: z.enum(["gpt-4o"]), // add models we want to support here
	instructions: z.string().nullable(),
	vectorStoreIds: z.array(z.string()).nullable().optional()
})

/**
 * OpenAI Prompt Config
 * Used for agents that use predefined prompts/templates
 */
const OpenAIPromptConfig = BaseConfig.extend({
	type: z.literal("openai-prompt"), // discriminator
	prompt: z.object({
		id: z.string(),
		version: z.string().optional()
	})
})

// AGENT UNION TYPE
export const AgentConfig = z.discriminatedUnion("type", [MockAgentConfig, MistralConversationConfig, MistralAgentConfig, OpenAIAResponseConfig, OpenAIPromptConfig, OllamaAIResponseConfig])

export type Prettify<T> = { [K in keyof T]: T[K] } & {}

export type AgentConfig = z.infer<typeof AgentConfig>

// DB AGENT AND CONVERSATION TYPES
export const DBAgent = z.object({
	_id: z.string(),
	vendorId: SupportedVendorIds,
	name: z.string(),
	description: z.string().nullable().optional(),
	config: AgentConfig,
	createdAt: z.iso.datetime(),
	createdBy: z.object({
		/** ObjectId in EntraID that created the agent */
		objectId: z.string(),
		name: z.string()
	}),
	updatedAt: z.iso.datetime(),
	updatedBy: z.object({
		/** ObjectId in EntraID that updated the agent */
		objectId: z.string(),
		name: z.string()
	}),
	authorizedGroupIds: z.literal("all").or(z.array(z.string())) // list of groupIds that have access to this agent or "all" for everyone
})

export type DBAgent = z.infer<typeof DBAgent>

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
export type IAgentResults = {
	GetAgentInfoResult: Agent
	CreateConversationResult: {
		vendorConversationId: string
		vectorStoreId: string | null
		response: ReadableStream<Uint8Array>
	}
	AppendToConversationResult: {
		response: ReadableStream<Uint8Array>
	}
	AddConversationVectorStoreFilesResult: IVendorResults["AddVectorStoreFilesResult"]
	GetConversationVectorStoreFilesResult: IVendorResults["GetVectorStoreFilesResult"]
	GetConversationVectorStoreFileContentResult: {
		redirectUrl?: string
		content?: Response
	}
	GetConversationMessagesResult: {
		messages: Message[]
	}
}

// AGENT INTERFACE
export interface IAgent {
	getAgentInfo(): Agent
	createConversation(conversation: DBConversation, initialPrompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["CreateConversationResult"]>
	appendMessageToConversation(conversation: DBConversation, prompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["AppendToConversationResult"]>
	addConversationVectorStoreFiles(conversation: DBConversation, files: File[], streamResponse: boolean): Promise<IAgentResults["AddConversationVectorStoreFilesResult"]>
	getConversationVectorStoreFiles(conversation: DBConversation): Promise<IAgentResults["GetConversationVectorStoreFilesResult"]>
	getConversationVectorStoreFileContent(conversation: DBConversation, fileId: string): Promise<IAgentResults["GetConversationVectorStoreFileContentResult"]>
	deleteConversationVectorStoreFile(conversation: DBConversation, fileId: string): Promise<void>
	getConversationMessages(conversation: DBConversation): Promise<IAgentResults["GetConversationMessagesResult"]>
}
