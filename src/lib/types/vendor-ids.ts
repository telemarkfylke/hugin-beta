import z from "zod"

// No circular dependencies please...
export const SupportedVendorIds = z.enum(["mistral", "openai", "ollama", "mock-ai"])

export type VendorId = z.infer<typeof SupportedVendorIds>
