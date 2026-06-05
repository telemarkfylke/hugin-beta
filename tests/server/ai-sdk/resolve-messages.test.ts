import { describe, expect, it } from "vitest"
import { resolveMessages } from "../../../src/lib/server/ai-sdk/resolve-messages"
import type { ChatInputItem } from "../../../src/lib/types/chat-item"

describe("resolveMessages", () => {
	it("converts a user text message", () => {
		const inputs: ChatInputItem[] = [
			{
				type: "message.input",
				role: "user",
				content: [{ type: "input_text", text: "Hello!" }]
			}
		]
		const result = resolveMessages(inputs)
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({ role: "user", content: [{ type: "text", text: "Hello!" }] })
	})

	it("converts an assistant output message", () => {
		const inputs: ChatInputItem[] = [
			{
				id: "resp-1",
				type: "message.output",
				role: "assistant",
				content: [{ type: "output_text", text: "Hi there!" }]
			}
		]
		const result = resolveMessages(inputs)
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({ role: "assistant", content: [{ type: "text", text: "Hi there!" }] })
	})

	it("converts a user message with an image", () => {
		const inputs: ChatInputItem[] = [
			{
				type: "message.input",
				role: "user",
				content: [
					{ type: "input_image", imageUrl: "data:image/png;base64,abc123" },
					{ type: "input_text", text: "What is this?" }
				]
			}
		]
		const result = resolveMessages(inputs)
		expect(result[0]).toMatchObject({
			role: "user",
			content: expect.arrayContaining([
				{ type: "image", image: "data:image/png;base64,abc123" },
				{ type: "text", text: "What is this?" }
			])
		})
	})

	it("converts a user message with a file", () => {
		const inputs: ChatInputItem[] = [
			{
				type: "message.input",
				role: "user",
				content: [{ type: "input_file", fileName: "doc.pdf", fileUrl: "data:application/pdf;base64,abc123" }]
			}
		]
		const result = resolveMessages(inputs)
		expect(result[0]).toMatchObject({
			role: "user",
			content: expect.arrayContaining([expect.objectContaining({ type: "file" })])
		})
	})

	it("handles both user and assistant messages in sequence", () => {
		const inputs: ChatInputItem[] = [
			{
				type: "message.input",
				role: "user",
				content: [{ type: "input_text", text: "Hello" }]
			},
			{
				id: "resp-1",
				type: "message.output",
				role: "assistant",
				content: [{ type: "output_text", text: "Hi" }]
			}
		]
		const result = resolveMessages(inputs)
		expect(result).toHaveLength(2)
	})
})
