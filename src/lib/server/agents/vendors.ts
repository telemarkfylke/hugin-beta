import type { VendorId } from "$lib/types/vendor-ids"
import type { IVendor } from "$lib/types/vendors"
import { MistralVendor } from "../mistral/mistral"
import { MockAIVendor } from "../mock-ai/mock-ai"
import { OllamaVendor } from "../ollama/ollama"
import { OpenAIVendor } from "../openai/openai"

export const createVendor = (vendorId: VendorId): IVendor => {
	if (!vendorId) {
		throw new Error("vendorId is required to create a vendor")
	}
	if (vendorId === "mistral") {
		return new MistralVendor()
	}
	if (vendorId === "openai") {
		return new OpenAIVendor()
	}
	if (vendorId === "ollama") {
		return new OllamaVendor()
	}
	if (vendorId === "mock-ai") {
		return new MockAIVendor()
	}
	throw new Error(`Unsupported vendor: ${vendorId}`)
}
