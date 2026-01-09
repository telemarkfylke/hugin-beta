import type { VendorSupportedMessageMimeTypesMap } from "./types/AIVendor"

export const OPEN_AI_VENDOR_ID = "openai"

const OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES = ["application/pdf"]
const OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/bmp", "image/tiff", "image/heif"]

export const VENDOR_SUPPORTED_MESSAGE_MIME_TYPES: VendorSupportedMessageMimeTypesMap = {
  [`${OPEN_AI_VENDOR_ID}-gpt-4o`]: {
    file: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
    image: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
  },
  [`${OPEN_AI_VENDOR_ID}-gpt-4`]: {
    file: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
    image: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
  }
}

/*
Vi har en config med en vendorId (som vi vet) og en model (som vi ikke nødvendigvis vet noe om)

Hvis vi vi hardkoder inn en map/object med key som er {vendorId}-{model}, og hvis den finnes så kan vi la bruker laste opp filer med de mime typene som er i arrayet for den keyen. Hvis den ikke finnes, så kan vi ikke tillate noen fil opplastinger.
*/

/**
 * @link https://help.mistral.ai/en/articles/347521-how-do-i-upload-images-or-documents-to-le-chat
 */
export const MISTRAL_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

/**
 * @link https://help.mistral.ai/en/articles/347521-how-do-i-upload-images-or-documents-to-le-chat
 */
export const MISTRAL_SUPPORTED_MESSAGE_FILE_MIME_TYPES = [
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
 * @link https://help.mistral.ai/en/articles/347583-what-kinds-of-documents-can-i-upload-to-my-libraries
 */
export const MISTRAL_SUPPORTED_VECTOR_STORE_FILE_MIME_TYPES = [
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
	"text/csv",
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp"
]

// TA OG FIKS MISTRAL når tiden kommer
