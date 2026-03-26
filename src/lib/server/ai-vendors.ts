import type { IAIVendor } from "$lib/types/AIVendor"
import type { VendorId } from "$lib/types/chat"
import { APP_CONFIG } from "./app-config/app-config"
import { LitellmVendor } from "./litellm/litellm-vendor"
import { MistralVendor } from "./mistral/mistral-vendor"
import { OllamaAIVendor } from "./ollama/ollama-vendor"
import { OpenAIVendor } from "./openai/openai-vendor"

let openAIVendor: IAIVendor | null = null
let mistralVendor: IAIVendor | null = null
let ollamaVendor: IAIVendor | null = null
let litellmVendor: IAIVendor | null = null

if (APP_CONFIG.VENDORS.OPENAI.ENABLED) {
	openAIVendor = new OpenAIVendor()
}

if (APP_CONFIG.VENDORS.MISTRAL.ENABLED) {
	mistralVendor = new MistralVendor()
}

if (APP_CONFIG.VENDORS.OLLAMA.ENABLED) {
	ollamaVendor = new OllamaAIVendor()
}

if (APP_CONFIG.VENDORS.LITELLM.ENABLED) {
	litellmVendor = new LitellmVendor()
}

export const getVendor = (vendorId: VendorId): IAIVendor => {
	if (!vendorId) {
		throw new Error("vendorId is required to get a vendor")
	}
	if (vendorId === "OPENAI") {
		if (!openAIVendor) {
			throw new Error("OpenAI vendor is not initialized. Missing OPENAI_API_KEY?")
		}
		return openAIVendor
	}
	if (vendorId === "MISTRAL") {
		if (!mistralVendor) {
			throw new Error("Mistral vendor is not initialized. Missing MISTRAL_API_KEY?")
		}
		return mistralVendor
	}
	if (vendorId === "OLLAMA") {
		if (!ollamaVendor) {
			throw new Error("Ollama vendor is not initialized. Missing OLLAMA_HOST?")
		}
		return ollamaVendor
	}
	if (vendorId === "LITELLM") {
		if (!litellmVendor) {
			throw new Error("LiteLLM vendor is not initialized. Missing LITELLM_BASE_URL?")
		}
		return litellmVendor
	}
	throw new Error(`Unsupported vendor: ${vendorId}`)
}
