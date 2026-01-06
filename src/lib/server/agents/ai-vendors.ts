import { env } from "$env/dynamic/private"
import type { IAIVendor } from "$lib/types/AIVendor"
import { OpenAIVendor } from "../openai/openai-vendor"

export const OPENAI_VENDOR_ID = "openai"

let openAIVendor : IAIVendor | null = null

if (env.OPENAI_API_KEY) {
	openAIVendor = new OpenAIVendor()
}

export const getVendor = (vendorId: string): IAIVendor => {
	if (!vendorId) {
		throw new Error("vendorId is required to get a vendor")
	}
	if (vendorId === OPENAI_VENDOR_ID) {
		if (!openAIVendor) {
			throw new Error("OpenAI vendor is not initialized. Missing OPENAI_API_KEY?")
		}
		return openAIVendor
	}
	throw new Error(`Unsupported vendor: ${vendorId}`)
}

