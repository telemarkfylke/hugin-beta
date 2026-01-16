import type { IAIVendor } from "$lib/types/AIVendor"
import type { VendorId } from "$lib/types/chat"
import { APP_CONFIG } from "./app-config/app-config"
import { MistralVendor } from "./mistral/mistral-vendor"
import { OpenAIVendor } from "./openai/openai-vendor"

let openAIVendor: IAIVendor | null = null
let mistralVendor: IAIVendor | null = null

if (APP_CONFIG.VENDORS.OPENAI.ENABLED) {
	openAIVendor = new OpenAIVendor()
}

if (APP_CONFIG.VENDORS.MISTRAL.ENABLED) {
	mistralVendor = new MistralVendor()
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
	throw new Error(`Unsupported vendor: ${vendorId}`)
}
