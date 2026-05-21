import { HTTPError } from "../server/middleware/http-error"
import type { AppConfig } from "../types/app-config"
import type { ChatConfig } from "../types/chat"
import { ChatConfigSchema } from "./chat-config-schema"

export { ChatConfigSchema }

export const parseChatConfig = (input: unknown, APP_CONFIG: AppConfig): ChatConfig => {
	if (!input || typeof input !== "object") {
		throw new HTTPError(400, "Invalid chat config input")
	}
	const parseResult = ChatConfigSchema.safeParse(input)
	if (!parseResult.success) {
		throw new HTTPError(400, "Invalid chat config", parseResult.error.issues)
	}
	const parsedConfig = parseResult.data

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
		// Predefined config
		if (!parsedConfig.vendorAgent.id || typeof parsedConfig.vendorAgent.id !== "string") {
			throw new HTTPError(400, "vendorAgent.id must be a string")
		}
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
	if (!VENDOR.MODELS.some((model) => model.ID === parsedConfig.model)) {
		throw new HTTPError(400, `Unsupported model: ${parsedConfig.model} for vendorId: ${parsedConfig.vendorId}`)
	}

	// NB : Husk å legge til propertiene i dette objektet også. Spesielt hvis det er optional så er det lett å glemme.
	return {
		_id: parsedConfig._id,
		name: parsedConfig.name,
		description: parsedConfig.description,
		vendorId: parsedConfig.vendorId,
		project: parsedConfig.project,
		model: parsedConfig.model,
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
