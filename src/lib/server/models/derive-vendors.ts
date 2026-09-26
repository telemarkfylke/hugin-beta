import {
	MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
	MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES,
	OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
	OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
} from "$lib/server/app-config/supported-mime-types"
import type { ModelInfo } from "$lib/types/app-config"
import type { VendorId } from "$lib/types/chat"
import type { MimeTypes } from "$lib/types/model-profiles"
import type { FilePreset, ModelConfig } from "./types"

export const resolveFilePreset = (files: FilePreset): MimeTypes => {
	if (files === "openai") {
		return { FILE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES, IMAGE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES }
	}
	if (files === "mistral") {
		return { FILE: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES, IMAGE: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES }
	}
	if (files === "none") {
		return { FILE: [], IMAGE: [] }
	}
	return files
}

// APP_CONFIG.VENDORS[vendorId].MODELS, built from the catalogue. Internal models are left out - they
// are never offered, pinned or validated as a chat model. Retired models stay in (flagged) so old
// conversations still find their mime types and the vendor implementations still accept them.
export const deriveVendorModels = (config: ModelConfig, vendorId: VendorId): ModelInfo[] => {
	return Object.entries(config.MODELS)
		.filter(([_key, model]) => model.vendor === vendorId && !model.internal)
		.map(([key, model]) => ({
			KEY: key,
			ID: model.providerModel,
			SUPPORTED_MESSAGE_FILE_MIME_TYPES: resolveFilePreset(model.files),
			CAPABILITIES: model.capabilities,
			RETIRED: model.status === "retired"
		}))
}
