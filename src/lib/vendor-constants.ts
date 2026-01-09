import type { VendorSupportedMessageMimeTypesMap } from "./types/AIVendor"

// Vendor IDs
export const OPEN_AI_VENDOR_ID = "openai"
export const MISTRAL_VENDOR_ID = "mistral"

const OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES = ["application/pdf"]
const OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/bmp", "image/tiff", "image/heif"]

/**
 * @link https://help.mistral.ai/en/articles/347521-how-do-i-upload-images-or-documents-to-le-chat
 */
const MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES = [
	"text/css",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"text/html",
	"text/javascript",
	"application/json",
	"text/markdown",
	"application/pdf",
	"text/x-php",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"text/x-python",
	"text/x-script.python",
	"application/typescript",
	"text/plain",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"text/csv"
]

/**
 * @link https://help.mistral.ai/en/articles/347521-how-do-i-upload-images-or-documents-to-le-chat
 */
const MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

export const VENDOR_SUPPORTED_MESSAGE_MIME_TYPES: VendorSupportedMessageMimeTypesMap = {
	[`${OPEN_AI_VENDOR_ID}-gpt-4o`]: {
		file: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
		image: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
	},
	[`${OPEN_AI_VENDOR_ID}-gpt-4`]: {
		file: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
		image: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
	},
	[`${MISTRAL_VENDOR_ID}-mistral-medium-latest`]: {
		file: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
		image: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
	},
	[`${MISTRAL_VENDOR_ID}-mistral-large-latest`]: {
		file: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
		image: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
	}
}
