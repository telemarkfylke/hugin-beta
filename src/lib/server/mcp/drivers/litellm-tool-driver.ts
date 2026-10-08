import type OpenAI from "openai"
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions"
import { chatInputToCompletionMessage } from "$lib/server/litellm/litellm-mapping"
import type { ChatRequest } from "$lib/types/chat"
import type { ToolResult, ToolTurnDriver, ToolTurnEvent } from "../agentic-loop"
import { type McpToolDefinition, mcpToolToCompletionTool } from "../mcp-tools"

type AssemblingCall = { id: string; name: string; arguments: string }

export const createLitellmToolDriver = (client: OpenAI, chatRequest: ChatRequest, tools: McpToolDefinition[]): ToolTurnDriver => {
	const messages: ChatCompletionMessageParam[] = chatRequest.inputs.map(chatInputToCompletionMessage)
	if (chatRequest.config.instructions) {
		messages.unshift({ role: "system", content: chatRequest.config.instructions })
	}
	const completionTools = tools.map(mcpToolToCompletionTool) as ChatCompletionTool[]

	async function* runTurn(): AsyncIterable<ToolTurnEvent> {
		const model = chatRequest.config.model
		if (!model) {
			throw new Error("Model is required for LiteLLM MCP driver")
		}
		const stream = await client.chat.completions.create({
			model,
			messages,
			...(completionTools.length > 0 ? { tools: completionTools } : {}),
			stream: true,
			stream_options: { include_usage: true }
		})

		const itemId = `litellm_${messages.length}`
		const assembling = new Map<number, AssemblingCall>()
		let assistantContent = ""

		for await (const chunk of stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
			const choice = chunk.choices[0]
			const delta = choice?.delta
			if (delta?.content) {
				assistantContent += delta.content
				yield { type: "text_delta", itemId, content: delta.content }
			}
			for (const tc of delta?.tool_calls ?? []) {
				const current = assembling.get(tc.index) ?? { id: "", name: "", arguments: "" }
				if (tc.id) current.id = tc.id
				if (tc.function?.name) current.name = tc.function.name
				if (tc.function?.arguments) current.arguments += tc.function.arguments
				assembling.set(tc.index, current)
			}
			if (chunk.usage) {
				yield { type: "usage", usage: { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens, totalTokens: chunk.usage.total_tokens } }
			}
		}

		const calls = [...assembling.values()]
		if (calls.length > 0) {
			messages.push({
				role: "assistant",
				content: assistantContent.length > 0 ? assistantContent : null,
				tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } }))
			})
			for (const c of calls) {
				yield { type: "tool_call", callId: c.id, toolName: c.name, arguments: c.arguments }
			}
		} else if (assistantContent.length > 0) {
			messages.push({ role: "assistant", content: assistantContent })
		}
	}

	return {
		start() {
			return runTurn()
		},
		continueWith(results: ToolResult[]) {
			for (const result of results) {
				messages.push({ role: "tool", tool_call_id: result.callId, content: result.output })
			}
			return runTurn()
		}
	}
}
