/**
 * Office, PDF, text and code documents - accepted as message files by both Mistral and OpenAI.
 * @link https://help.mistral.ai/en/articles/347521-how-do-i-upload-images-or-documents-to-le-chat
 * @link https://developers.openai.com/api/docs/guides/pdf-files (Responses API input_file - Hugin uses the Responses API, not Chat Completions, which only takes PDF)
 */
const DOCUMENT_MIME_TYPES = [
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

export const OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES = DOCUMENT_MIME_TYPES
export const OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/bmp", "image/tiff", "image/heif"]

export const MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES = DOCUMENT_MIME_TYPES

/**
 * @link https://help.mistral.ai/en/articles/347521-how-do-i-upload-images-or-documents-to-le-chat
 */
export const MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
