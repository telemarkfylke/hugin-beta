import { describe, expect, it } from "vitest"
import { stripAttachmentsExceptLatest } from "../../src/lib/chat-history"
import type { ChatInputItem } from "../../src/lib/types/chat-item"

const file = { type: "input_file", fileName: "rapport.pdf", fileUrl: "data:application/pdf;base64,AAA" } as const
const image = { type: "input_image", imageUrl: "data:image/png;base64,BBB" } as const
const answer = (id: string): ChatInputItem => ({ id, type: "message.output", role: "assistant", content: [{ type: "output_text", text: "svar" }] })

describe("stripAttachmentsExceptLatest", () => {
	it("keeps attachments on the last user message and replaces earlier ones with a note", () => {
		const out = stripAttachmentsExceptLatest([
			{ type: "message.input", role: "user", content: [{ type: "input_text", text: "les denne" }, file] },
			answer("1"),
			{ type: "message.input", role: "user", content: [image] },
			answer("2"),
			{ type: "message.input", role: "user", content: [{ type: "input_text", text: "og denne" }, file] }
		])

		expect(out[0]).toEqual({
			type: "message.input",
			role: "user",
			content: [
				{ type: "input_text", text: "les denne" },
				{ type: "input_text", text: expect.stringContaining("«rapport.pdf»") }
			]
		})
		expect(out[2]).toEqual({ type: "message.input", role: "user", content: [{ type: "input_text", text: expect.stringContaining("(bilde)") }] })
		expect(out[4]).toEqual({ type: "message.input", role: "user", content: [{ type: "input_text", text: "og denne" }, file] })
		expect(out[1]).toEqual(answer("1"))
	})

	it("returns text-only history unchanged", () => {
		const inputs: ChatInputItem[] = [{ type: "message.input", role: "user", content: [{ type: "input_text", text: "hei" }] }, answer("1")]
		expect(stripAttachmentsExceptLatest(inputs)).toEqual(inputs)
	})
})
