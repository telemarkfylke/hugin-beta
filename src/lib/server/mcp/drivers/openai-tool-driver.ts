import type OpenAI from "openai"
import type { ResponseInputItem, Tool } from "openai/resources/responses/responses.mjs"
import { MAX_OUTPUT_TOKENS } from "$lib/server/models/models.config"
import { chatInputToOpenAIInput, OUTPUT_LIMIT_NOTICE, usageFromOpenAIResponse, wasCutOffByOutputLimit } from "$lib/server/openai/openai-mapping"
import type { ChatRequest } from "$lib/types/chat"
import type { ToolResult, ToolTurnDriver, ToolTurnEvent } from "../agentic-loop"
import { type McpToolDefinition, mcpToolToOpenAIResponsesTool } from "../mcp-tools"

export const createOpenAIToolDriver = (openai: OpenAI, chatRequest: ChatRequest, tools: McpToolDefinition[]): ToolTurnDriver => {
	const input: ResponseInputItem[] = chatRequest.inputs.map(chatInputToOpenAIInput)
	const hasWebSearch = chatRequest.config.tools?.some((t) => t.type === "web_search") ?? false
	const responsesTools: Tool[] = [...(hasWebSearch ? [{ type: "web_search_preview" as const }] : []), ...tools.map(mcpToolToOpenAIResponsesTool)]

	async function* runTurn(): AsyncIterable<ToolTurnEvent> {
		const model = chatRequest.config.model
		if (!model) {
			throw new Error("Model is required for OpenAI MCP driver")
		}
		const stream = await openai.responses.create({
			model,
			instructions: chatRequest.config.instructions || "",
			input,
			store: false,
			max_output_tokens: MAX_OUTPUT_TOKENS,
			...(responsesTools.length > 0 ? { tools: responsesTools } : {}),
			stream: true
		})

		let lastTextItemId: string | undefined
		for await (const chunk of stream) {
			switch (chunk.type) {
				case "response.output_text.delta":
					lastTextItemId = chunk.item_id
					yield { type: "text_delta", itemId: chunk.item_id, content: chunk.delta }
					break
				case "response.output_item.done":
					if (chunk.item.type === "function_call") {
						// Persist the function_call so the next turn's input includes it.
						input.push(chunk.item)
						yield { type: "tool_call", callId: chunk.item.call_id, toolName: chunk.item.name, arguments: chunk.item.arguments }
					}
					break
				case "response.completed":
				case "response.incomplete":
					if (chunk.type === "response.incomplete" && wasCutOffByOutputLimit(chunk.response)) {
						yield { type: "text_delta", itemId: lastTextItemId ?? `cut_off_${chunk.response.id}`, content: OUTPUT_LIMIT_NOTICE }
					}
					yield { type: "usage", usage: usageFromOpenAIResponse(chunk.response) }
					break
				default:
					break
			}
		}
	}

	return {
		start() {
			return runTurn()
		},
		continueWith(results: ToolResult[]) {
			for (const result of results) {
				const toolOutput: ResponseInputItem.FunctionCallOutput = {
					type: "function_call_output",
					call_id: result.callId,
					output: result.output
				}
				input.push(toolOutput)
			}
			return runTurn()
		}
	}
}
