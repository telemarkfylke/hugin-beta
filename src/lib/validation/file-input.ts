import { HTTPError } from "$lib/server/middleware/http-error"
import type { AppConfig } from "$lib/types/app-config"
import type { ChatRequest } from "$lib/types/chat"

const validFileType = (fileUrl: string, supportedMimeTypes: string[]): boolean => {
  const mimeType = fileUrl.substring(fileUrl.indexOf(":") + 1, fileUrl.indexOf(";base64")) // data:<mime-type>;base64,<data>
  return supportedMimeTypes.includes(mimeType)
}

export const validateFileInputs = (chatRequest: ChatRequest, APP_CONFIG: AppConfig) => {
  const lastMessage = chatRequest.inputs[chatRequest.inputs.length - 1]
  if (!lastMessage || lastMessage.type !== "message.input") {
    throw new HTTPError(400, "Last input must be a message.input to validate file inputs")
  }

  const vendor = APP_CONFIG.VENDORS[chatRequest.config.vendorId]
  if (!vendor) {
    throw new HTTPError(400, `Unsupported vendorId: ${chatRequest.config.vendorId}`)
  }

  const modelSupportedMimeTypes = vendor.MODELS.find((model) => model.ID === chatRequest.config.model)?.SUPPORTED_MESSAGE_FILE_MIME_TYPES || {
    FILE: [],
    IMAGE: []
  }

  const supportedMimeTypes = [...modelSupportedMimeTypes.FILE, ...modelSupportedMimeTypes.IMAGE]

  const fileInputs = lastMessage.content.filter((contentItem) => contentItem.type === "input_file" || contentItem.type === "input_image")
  for (const fileInput of fileInputs.slice(-1)) {
    if (!validFileType(fileInput.type === "input_file" ? fileInput.fileUrl : fileInput.imageUrl, supportedMimeTypes)) {
      throw new HTTPError(400, `File type of uploaded file is not supported for vendor/model: ${chatRequest.config.vendorId}-${chatRequest.config.model}`)
    }
  }

  // Filter out all previous file inputs of not valid mimetype (in case someone changed model/vendor mid-conversation)
  for (const [index, inputItem] of chatRequest.inputs.entries()) {
    if (index === chatRequest.inputs.length - 1) {
      continue // Skip last message, already validated
    }
    if (inputItem.type !== "message.input") {
      continue
    }
    inputItem.content = inputItem.content.filter((contentItem) => {
      if (contentItem.type === "input_file") {
        return validFileType(contentItem.fileUrl, supportedMimeTypes)
      }
      if (contentItem.type === "input_image") {
        return validFileType(contentItem.imageUrl, supportedMimeTypes)
      }
      return true
    })
  }
}