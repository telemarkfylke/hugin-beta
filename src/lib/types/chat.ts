import type { ObjectId } from "mongodb"
import type { ProviderOptions } from "@ai-sdk/provider-utils"
import z from "zod"
import type { AppConfig } from "./app-config"

export type VendorId = keyof AppConfig["VENDORS"]

export type VendorAgent = {
	id: string
}

export type ChatTool = {
	type: "web_search"
}

export type RoleAccessGroups = "all" | "employee" | "edu_employee" | "student"
export type EntraAccessGroup = {
	id: string
	displayName: string
}

export type ChatConfig = {
	_id: string
	name: string
	description: string
	vendorId: VendorId
	project: string
	vendorAgent?: VendorAgent | undefined
	instructions?: string | undefined
	conversationId?: string | undefined
	tools?: ChatTool[] | undefined | null
	providerOptions?: ProviderOptions | undefined
	type: "published" | "private"
	shared?: boolean | undefined
	accessGroups: (RoleAccessGroups | EntraAccessGroup)[]
	created: {
		at: string
		by: {
			id: string
			name?: string | undefined
		}
	}
	updated: {
		at: string
		by: {
			id: string
			name?: string | undefined
		}
	}
}

export type DbChatConfig = Omit<ChatConfig, "_id"> & { _id: ObjectId }
export type NewChatConfig = Omit<ChatConfig, "_id">

export type Chat = {
	_id: string
	config: ChatConfig
	createdAt: string
	updatedAt: string
	owner: {
		id: string
		name?: string | undefined
	}
}

/**
 *
 * @link https://github.com/colinhacks/zod/issues/372#issuecomment-826380330
 */

export const schemaForType =
	<T>() =>
	// biome-ignore lint: Unexpected any
	<S extends z.ZodType<T, any>>(arg: S) => {
		return arg
	}

// New and better
export const ChatConfigSchema = schemaForType<ChatConfig>()(
	z.object({
		_id: z.string(),
		name: z.string(),
		description: z.string(),
		vendorId: z.enum(["MISTRAL", "OPENAI"]), // Update as per AppConfig Vendor keys for now
		project: z.string(),
		vendorAgent: z.object({ id: z.string() }).optional(),
		tools: z
			.array(z.object({ type: z.enum(["web_search"]) }))
			.nullable()
			.optional(), // Update as per ChatTool for now
		// biome-ignore lint: ProviderOptions is a complex recursive type that Zod cannot infer exactly
		providerOptions: z.custom<ProviderOptions>().optional(),
		shared: z.boolean().optional(),
		instructions: z.string().optional(),
		conversationId: z.string().optional(),
		type: z.enum(["published", "private"]), // Update as per ChatConfig for now
		accessGroups: z.array(z.union([z.literal("all"), z.literal("employee"), z.literal("edu_employee"), z.literal("student"), z.object({ id: z.string(), displayName: z.string() })])),
		created: z.object({
			at: z.string(),
			by: z.object({
				id: z.string(),
				name: z.string().optional()
			})
		}),
		updated: z.object({
			at: z.string(),
			by: z.object({
				id: z.string(),
				name: z.string().optional()
			})
		})
	})
)
