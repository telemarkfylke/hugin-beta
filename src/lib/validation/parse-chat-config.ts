import z from "zod"
import { HTTPError } from "../server/middleware/http-error"
import type { AppConfig } from "../types/app-config"
import { type ChatConfig, ChatConfigSchema } from "../types/chat"

export const parseChatConfig = (input: unknown, APP_CONFIG: AppConfig): ChatConfig => {
	if (!input || typeof input !== "object") {
		throw new HTTPError(400, "Invalid chat config input")
	}
	let parsedConfig: z.infer<typeof ChatConfigSchema>
	try {
		parsedConfig = ChatConfigSchema.parse(input)
	} catch {
		throw new HTTPError(400, "Invalid chat config: malformed fields")
	}

	const VENDOR = APP_CONFIG.VENDORS[parsedConfig.vendorId]
	if (!VENDOR) {
		throw new HTTPError(400, `Unsupported vendorId: ${parsedConfig.vendorId}`)
	}
	if (!VENDOR.PROJECTS.includes(parsedConfig.project)) {
		throw new HTTPError(400, `Unsupported project: ${parsedConfig.project} for vendorId: ${parsedConfig.vendorId}`)
	}
	if (!VENDOR.ENABLED) {
		throw new HTTPError(400, `VendorId: ${parsedConfig.vendorId} is not enabled`)
	}
	if (parsedConfig.vendorAgent) {
		// Predefined config — vendorAgent.id already validated by Zod schema
		return {
			_id: parsedConfig._id,
			name: parsedConfig.name,
			description: parsedConfig.description,
			vendorId: parsedConfig.vendorId,
			project: parsedConfig.project,
			vendorAgent: {
				id: parsedConfig.vendorAgent.id
			},
			shared: parsedConfig.shared,
			accessGroups: parsedConfig.accessGroups,
			type: parsedConfig.type,
			created: parsedConfig.created,
			updated: parsedConfig.updated
		}
	}
	// Manual config
	return {
		_id: parsedConfig._id,
		name: parsedConfig.name,
		description: parsedConfig.description,
		vendorId: parsedConfig.vendorId,
		project: parsedConfig.project,
		instructions: parsedConfig.instructions,
		conversationId: parsedConfig.conversationId,
		tools: parsedConfig.tools || [],
		shared: parsedConfig.shared,
		accessGroups: parsedConfig.accessGroups,
		type: parsedConfig.type,
		created: parsedConfig.created,
		updated: parsedConfig.updated
	}
}
