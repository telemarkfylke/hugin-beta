import type { Mistral } from "@mistralai/mistralai"

export const MISTRAL_UPLOADED_FILE_EXPIRY_HOURS = 24

export const dataUrlToBlob = (dataUrl: string): Blob => {
	const match = dataUrl.match(/^data:([^;,]+);base64,(.*)$/)
	if (!match?.[1] || !match[2]) {
		throw new Error("Invalid base64 data URL")
	}
	const bytes = Buffer.from(match[2], "base64")
	return new Blob([bytes], { type: match[1] })
}

export const uploadMistralDataUrlAndGetSignedUrl = async (mistral: Mistral, dataUrl: string, fileName: string): Promise<string> => {
	const blob = dataUrlToBlob(dataUrl)
	const file = new File([blob], fileName, { type: blob.type })
	const uploaded = await mistral.files.upload({
		file,
		purpose: "ocr",
		visibility: "user",
		expiry: MISTRAL_UPLOADED_FILE_EXPIRY_HOURS
	})
	const signedUrl = await mistral.files.getSignedUrl({ fileId: uploaded.id, expiry: MISTRAL_UPLOADED_FILE_EXPIRY_HOURS })
	return signedUrl.url
}
