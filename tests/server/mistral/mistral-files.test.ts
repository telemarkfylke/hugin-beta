import type { Mistral } from "@mistralai/mistralai"
import { describe, expect, it, vi } from "vitest"
import { dataUrlToBlob, MISTRAL_UPLOADED_FILE_EXPIRY_HOURS, uploadMistralDataUrlAndGetSignedUrl } from "$lib/server/mistral/mistral-files"

describe("dataUrlToBlob", () => {
	it("converts base64 data URLs to typed blobs", async () => {
		const blob = dataUrlToBlob("data:text/plain;base64,SGVsbG8=")

		expect(blob.type).toBe("text/plain")
		expect(await blob.text()).toBe("Hello")
	})

	it("rejects invalid data URLs", () => {
		expect(() => dataUrlToBlob("https://example.com/file.pdf")).toThrow("Invalid base64 data URL")
	})

	it("uploads files with one-day expiry and returns a one-day signed URL", async () => {
		const upload = vi.fn().mockResolvedValue({ id: "file-1" })
		const getSignedUrl = vi.fn().mockResolvedValue({ url: "https://signed.example/file-1" })
		const mistral = { files: { upload, getSignedUrl } } as unknown as Mistral

		const url = await uploadMistralDataUrlAndGetSignedUrl(mistral, "data:text/plain;base64,SGVsbG8=", "hello.txt")

		expect(url).toBe("https://signed.example/file-1")
		expect(upload).toHaveBeenCalledWith({
			file: expect.any(File),
			purpose: "ocr",
			visibility: "user",
			expiry: MISTRAL_UPLOADED_FILE_EXPIRY_HOURS
		})
		expect(getSignedUrl).toHaveBeenCalledWith({ fileId: "file-1", expiry: MISTRAL_UPLOADED_FILE_EXPIRY_HOURS })
	})
})
