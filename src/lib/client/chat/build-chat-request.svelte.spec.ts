import { describe, expect, it } from "vitest"
import type { Chat, ChatConfig, ChatRequest } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import { buildChatRequest } from "./build-chat-request"

const baseConfig = (): ChatConfig => ({
	_id: "config-1",
	name: "Test Config",
	description: "",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4.1",
	type: "private",
	accessGroups: [],
	tools: [],
	created: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1" } },
	updated: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1" } }
})

const baseChat = (): Chat => ({
	_id: "chat-1",
	config: baseConfig(),
	history: [],
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	owner: { id: "user-1" }
})

const userMessage = (): ChatInputItem => ({
	type: "message.input",
	role: "user",
	content: [{ type: "input_text", text: "Hello" }]
})

describe("buildChatRequest", () => {
	it("produces a ChatRequest with the user message appended to inputs", () => {
		const chat = baseChat()
		const msg = userMessage()
		const result: ChatRequest = buildChatRequest(chat, msg, false, true, false)
		expect(result.inputs).toContain(msg)
		expect(result.inputs[result.inputs.length - 1]).toBe(msg)
	})

	it("flattens chat_response outputs into inputs", () => {
		const chat = baseChat()
		const assistantOutput: ChatInputItem = {
			id: "msg-out-1",
			type: "message.output",
			role: "assistant",
			content: [{ type: "output_text", text: "Hi there" }]
		}
		chat.history.push({
			id: "resp-1",
			type: "chat_response",
			config: baseConfig(),
			createdAt: "2026-01-01T00:00:00.000Z",
			outputs: [assistantOutput],
			status: "completed",
			usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
		})
		const msg = userMessage()
		const result = buildChatRequest(chat, msg, false, true, false)
		expect(result.inputs).toContain(assistantOutput)
		expect(result.inputs).toContain(msg)
		// chat_response wrapper should not be in inputs directly
		expect(result.inputs.find((i) => (i as { type: string }).type === "chat_response")).toBeUndefined()
	})

	it("adds web_search tool when webSearchEnabled is true", () => {
		const chat = baseChat()
		const result = buildChatRequest(chat, userMessage(), true, true, false)
		expect(result.config.tools).toBeDefined()
		expect(result.config.tools?.some((t) => t.type === "web_search")).toBe(true)
		expect(result.config.tools?.[0]?.type).toBe("web_search")
	})

	it("removes web_search tool when webSearchEnabled is false even if config.tools had it", () => {
		const chat = baseChat()
		chat.config.tools = [{ type: "web_search" }]
		const result = buildChatRequest(chat, userMessage(), false, true, false)
		expect(result.config.tools?.some((t) => t.type === "web_search")).toBe(false)
	})

	it("passes stream=true and store=false through correctly", () => {
		const chat = baseChat()
		const result = buildChatRequest(chat, userMessage(), false, true, false)
		expect(result.stream).toBe(true)
		expect(result.store).toBe(false)
	})

	it("passes stream=false and store=true through correctly", () => {
		const chat = baseChat()
		const result = buildChatRequest(chat, userMessage(), false, false, true)
		expect(result.stream).toBe(false)
		expect(result.store).toBe(true)
	})

	it("uses model name as config.name fallback when config.name is empty string", () => {
		const chat = baseChat()
		chat.config.name = ""
		chat.config.model = "gpt-4.1"
		const result = buildChatRequest(chat, userMessage(), false, true, false)
		expect(result.config.name).toBe("gpt-4.1")
	})

	it("falls back to 'Ukjent navn' when both name and model are missing", () => {
		const chat = baseChat()
		chat.config.name = ""
		chat.config.model = undefined
		const result = buildChatRequest(chat, userMessage(), false, true, false)
		expect(result.config.name).toBe("Ukjent navn")
	})
})
