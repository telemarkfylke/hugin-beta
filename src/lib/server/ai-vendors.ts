import { env } from "$env/dynamic/private"
import type { IAIVendor } from "$lib/types/AIVendor"
import { MISTRAL_VENDOR_ID, OPEN_AI_VENDOR_ID } from "$lib/vendor-constants"
import { MistralVendor } from "./mistral/mistral-vendor"
import { OpenAIVendor } from "./openai/openai-vendor"

let openAIVendor: IAIVendor | null = null
let mistralVendor: IAIVendor | null = null

if (env.OPENAI_API_KEY) {
	openAIVendor = new OpenAIVendor()
}

if (env.MISTRAL_API_KEY) {
	mistralVendor = new MistralVendor()
}

export const getVendor = (vendorId: string): IAIVendor => {
	if (!vendorId) {
		throw new Error("vendorId is required to get a vendor")
	}
	if (vendorId === OPEN_AI_VENDOR_ID) {
		if (!openAIVendor) {
			throw new Error("OpenAI vendor is not initialized. Missing OPENAI_API_KEY?")
		}
		return openAIVendor
	}
	if (vendorId === MISTRAL_VENDOR_ID) {
		if (!mistralVendor) {
			throw new Error("Mistral vendor is not initialized. Missing MISTRAL_API_KEY?")
		}
		return mistralVendor
	}
	throw new Error(`Unsupported vendor: ${vendorId}`)
}
