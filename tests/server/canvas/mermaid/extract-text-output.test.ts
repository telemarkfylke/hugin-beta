import { describe, expect, it } from "vitest"
import type { ChatOutputItem } from "$lib/types/chat-item"
import { extractTextOutput } from "../../../../src/routes/api/canvas/mermaid/extract-text-output"

const messageOutput = (text: string): ChatOutputItem => ({
	id: "1",
	type: "message.output",
	role: "assistant",
	content: [{ type: "output_text", text }]
})

describe("extractTextOutput", () => {
	it("returns the text from a single real message output", () => {
		const outputs = [messageOutput("flowchart TD\n  A --> B")]
		expect(extractTextOutput(outputs)).toBe("flowchart TD\n  A --> B")
	})

	it("strips a reasoning-model placeholder mixed in with the real output", () => {
		const outputs = [messageOutput("Unsupported output item from OpenAI: reasoning"), messageOutput("flowchart TD\n  A --> B")]
		expect(extractTextOutput(outputs)).toBe("flowchart TD\n  A --> B")
	})

	it("returns an empty string when only a placeholder is present", () => {
		const outputs = [messageOutput("Unsupported output item from OpenAI: reasoning")]
		expect(extractTextOutput(outputs)).toBe("")
	})

	it("joins text from multiple real message outputs in order", () => {
		const outputs = [messageOutput("flowchart TD\n"), messageOutput("  A --> B")]
		expect(extractTextOutput(outputs)).toBe("flowchart TD\n  A --> B")
	})

	it("returns an empty string when the model only produced a refusal (no output_text content)", () => {
		const outputs: ChatOutputItem[] = [
			{
				id: "1",
				type: "message.output",
				role: "assistant",
				content: [{ type: "output_refusal", reason: "content policy" }]
			}
		]
		expect(extractTextOutput(outputs)).toBe("")
	})
})
