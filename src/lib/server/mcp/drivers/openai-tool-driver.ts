import type OpenAI from "openai"
import type { ResponseInputItem } from "openai/resources/responses/responses.mjs"
import { chatInputToOpenAIInput } from "$lib/server/openai/openai-mapping"
import type { ChatRequest } from "$lib/types/chat"
import type { ToolResult, ToolTurnDriver, ToolTurnEvent } from "../agentic-loop"
import { type McpToolDefinition, mcpToolToOpenAIResponsesTool } from "../mcp-tools"

export const createOpenAIToolDriver = (openai: OpenAI, chatRequest: ChatRequest, tools: McpToolDefinition[]): ToolTurnDriver => {
	const input: ResponseInputItem[] = chatRequest.inputs.map(chatInputToOpenAIInput)
	const responsesTools = tools.map(mcpToolToOpenAIResponsesTool)

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
			...(responsesTools.length > 0 ? { tools: responsesTools } : {}),
			stream: true
		})

		for await (const chunk of stream) {
			switch (chunk.type) {
				case "response.output_text.delta":
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
					yield {
						type: "usage",
						usage: {
							inputTokens: chunk.response.usage?.input_tokens || 0,
							outputTokens: chunk.response.usage?.output_tokens || 0,
							totalTokens: chunk.response.usage?.total_tokens || 0
						}
					}
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
