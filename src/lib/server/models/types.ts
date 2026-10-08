import type { RoleAccessGroups, VendorId } from "$lib/types/chat"
import type { MimeTypes, ModelCapability } from "$lib/types/model-profiles"

// "openai" / "mistral" point at the constants in app-config/supported-mime-types.ts. Give an explicit
// object only when a model differs from its vendor's defaults.
export type FilePreset = "openai" | "mistral" | "none" | MimeTypes

export type CatalogueModel = {
	vendor: VendorId
	// The model ID sent to the vendor SDK
	providerModel: string
	files: FilePreset
	capabilities: ModelCapability[]
	// Retired models are kept only so old assistants/conversations can still resolve - never offered, never pinnable
	status?: "active" | "retired"
	// Internal models (e.g. the utility LLM) are never offered to users or admins
	internal?: boolean
}

export type Profile = {
	id: string
	label: string
	// Material Symbols name (e.g. "bolt"), not an emoji - flag emoji don't render on Windows
	icon: string
	description: string
	// Key into ModelConfig.MODELS
	model: string
	dataLocation?: string
	// Who may choose this profile when building an assistant. Omitted = everyone. Same semantics as ChatConfig.accessGroups
	roles?: RoleAccessGroups[]
}

export type ModelDefaults = {
	// Profile ids
	chat: string
	assistant: string
	canvas: string
	// Model key (internal model), not a profile
	utility: string
}

export type ModelConfig = {
	MODELS: Record<string, CatalogueModel>
	PROFILES: Profile[]
	DEFAULTS: ModelDefaults
	// Stored ChatConfig.model (provider model ID, as saved before profiles existed) -> profile id
	LEGACY: Record<string, string>
}
