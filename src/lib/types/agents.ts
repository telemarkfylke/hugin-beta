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

const PredefinedConfig = BaseConfig.extend({
	type: z.literal("predefined"), // discriminator
	vendorAgent: z.object({ // Enten en forhåndsdefinert agent eller prompt
		id: z.string(),
		version: z.string().optional()
	})
})

const ManualConfig = BaseConfig.extend({
	type: z.literal("manual"), // discriminator
	model: z.string(),
	instructions: z.array(z.string()),
	vectorStoreIds: z.array(z.string()).nullable().optional()
})

export const AgentConfig = z.discriminatedUnion("type", [PredefinedConfig, ManualConfig])

export type AgentConfig = z.infer<typeof AgentConfig>

// DB AGENT AND CONVERSATION TYPES
export const DBAgentInput = z.object({
	vendorId: SupportedVendorIds,
	name: z.string(),
	description: z.string().nullable().optional(),
	config: AgentConfig,
	authorizedGroupIds: z.literal("all").or(z.array(z.string())) // list of groupIds that have access to this agent or "all" for everyone
})

export type DBAgentInput = z.infer<typeof DBAgentInput>

export const DBAgent = DBAgentInput.extend({
	_id: z.string(),
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
	})
})

export type DBAgent = z.infer<typeof DBAgent>

const MimeType = z.string()

// FULL AGENT TYPE
export const Agent = DBAgent.extend({
	allowedMimeTypes: z.object({
		messageImages: z.array(MimeType),
		messageFiles: z.array(MimeType),
		vectorStoreFiles: z.array(MimeType)
	}),
	models: z.object({
		supported: z.array(z.string()),
		default: z.string()
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
