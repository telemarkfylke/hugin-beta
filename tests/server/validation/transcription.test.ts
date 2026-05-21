import { describe, expect, it } from "vitest"
import { CreateJobSchema, DeleteJobSchema, UpdateJobSchema } from "$lib/validation/transcription"

describe("CreateJobSchema", () => {
	it("accepts a valid fileName", () => {
		const result = CreateJobSchema.safeParse({ fileName: "audio.mp3" })
		expect(result.success).toBe(true)
	})

	it("rejects empty fileName", () => {
		const result = CreateJobSchema.safeParse({ fileName: "" })
		expect(result.success).toBe(false)
	})

	it("rejects missing fileName", () => {
		const result = CreateJobSchema.safeParse({})
		expect(result.success).toBe(false)
	})
})

describe("UpdateJobSchema", () => {
	it("accepts valid id and processing status", () => {
		const result = UpdateJobSchema.safeParse({ id: "job-1", status: "processing" })
		expect(result.success).toBe(true)
	})

	it("rejects unknown status", () => {
		const result = UpdateJobSchema.safeParse({ id: "job-1", status: "completed" })
		expect(result.success).toBe(false)
	})

	it("rejects missing id", () => {
		const result = UpdateJobSchema.safeParse({ status: "processing" })
		expect(result.success).toBe(false)
	})
})

describe("DeleteJobSchema", () => {
	it("accepts minimal valid body", () => {
		const result = DeleteJobSchema.safeParse({ id: "job-1", fileName: "audio.mp3" })
		expect(result.success).toBe(true)
	})

	it("accepts body with valid audioUrl and docxUrl", () => {
		const result = DeleteJobSchema.safeParse({
			id: "job-1",
			fileName: "audio.mp3",
			audioUrl: "https://copyparty.example.com/audio.mp3",
			docxUrl: "https://copyparty.example.com/result.docx"
		})
		expect(result.success).toBe(true)
	})

	it("accepts null audioUrl and docxUrl", () => {
		const result = DeleteJobSchema.safeParse({ id: "job-1", fileName: "audio.mp3", audioUrl: null, docxUrl: null })
		expect(result.success).toBe(true)
	})

	it("rejects non-URL audioUrl", () => {
		const result = DeleteJobSchema.safeParse({ id: "job-1", fileName: "audio.mp3", audioUrl: "not-a-url" })
		expect(result.success).toBe(false)
	})

	it("rejects empty id", () => {
		const result = DeleteJobSchema.safeParse({ id: "", fileName: "audio.mp3" })
		expect(result.success).toBe(false)
	})
})
