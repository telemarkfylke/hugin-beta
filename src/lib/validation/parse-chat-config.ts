import { HTTPError } from "../server/middleware/http-error"
import type { AppConfig } from "../types/app-config"
import { ChatConfigSchema, type ChatConfig } from "../types/chat"

export const parseChatConfig = (input: unknown, APP_CONFIG: AppConfig): ChatConfig => {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid chat config input")
  }
  const parsedConfig = ChatConfigSchema.parse(input)
  
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
      }
    }
  }
  // Manual config
  if (!VENDOR.MODELS.some((model) => model.ID === parsedConfig.model)) {
    throw new HTTPError(400, `Unsupported model: ${parsedConfig.model} for vendorId: ${parsedConfig.vendorId}`)
  }
  return {
    _id: parsedConfig._id,
    name: parsedConfig.name,
    description: parsedConfig.description,
    vendorId: parsedConfig.vendorId,
    project: parsedConfig.project,
    model: parsedConfig.model,
    instructions: parsedConfig.instructions,
    conversationId: parsedConfig.conversationId,
  }
}
