import type { Mistral } from "@mistralai/mistralai"
import type { FunctionResultEntry, FunctionTool, InputEntries } from "@mistralai/mistralai/models/components"
import { chatInputToMistralInput } from "$lib/server/mistral/mistral-mapping"
import type { ChatRequest } from "$lib/types/chat"
import type { ToolResult, ToolTurnDriver, ToolTurnEvent } from "../agentic-loop"
import { type McpToolDefinition, mcpToolToMistralTool } from "../mcp-tools"

export const createMistralToolDriver = (mistral: Mistral, chatRequest: ChatRequest, tools: McpToolDefinition[]): ToolTurnDriver => {
	const initialInputs: InputEntries[] = chatRequest.inputs.map(chatInputToMistralInput)
	const functionTools: FunctionTool[] = tools.map(mcpToolToMistralTool)

	// Holds the conversationId returned by the initial startStream so continueWith can append to the same conversation.
	let conversationId: string | undefined

	async function* consume(stream: AsyncIterable<{ data: { type: string } & Record<string, unknown> }>): AsyncIterable<ToolTurnEvent> {
		for await (const chunk of stream) {
			const data = chunk.data
			switch (data.type) {
				case "conversation.response.started": {
					// ResponseStartedEvent.conversationId — used to continue the conversation via appendStream.
					const id = data.conversationId
					if (typeof id === "string") {
						conversationId = id
					}
					break
				}
				case "message.output.delta": {
					// MessageOutputEvent: content is either a plain string or an OutputContentChunks object (mirrors mistral-stream.ts).
					const itemId = typeof data.id === "string" ? data.id : "mistral_message"
					const content = data.content
					if (typeof content === "string") {
						yield { type: "text_delta", itemId, content }
					} else if (content && typeof content === "object" && (content as { type?: string }).type === "text") {
						const text = (content as { text?: unknown }).text
						if (typeof text === "string") {
							yield { type: "text_delta", itemId, content: text }
						}
					}
					break
				}
				case "function.call.delta": {
					// FunctionCallEvent: carries the complete function call (name, toolCallId, arguments) in a single event.
					const toolCallId = data.toolCallId
					const name = data.name
					const args = data.arguments
					if (typeof toolCallId === "string" && typeof name === "string" && typeof args === "string") {
						yield { type: "tool_call", callId: toolCallId, toolName: name, arguments: args }
					}
					break
				}
				case "conversation.response.done": {
					// ResponseDoneEvent.usage is a ConversationUsageInfo (promptTokens/completionTokens/totalTokens).
					const usage = data.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined
					yield {
						type: "usage",
						usage: {
							inputTokens: usage?.promptTokens ?? 0,
							outputTokens: usage?.completionTokens ?? 0,
							totalTokens: usage?.totalTokens ?? 0
						}
					}
					break
				}
				default:
					break
			}
		}
	}

	async function* runStart(): AsyncIterable<ToolTurnEvent> {
		const model = chatRequest.config.model
		if (!model) {
			throw new Error("Model is required for Mistral MCP driver")
		}
		const stream = await mistral.beta.conversations.startStream({
			model,
			instructions: chatRequest.config.instructions || "",
			inputs: initialInputs,
			store: false,
			stream: true,
			...(functionTools.length > 0 ? { tools: functionTools } : {})
		})
		yield* consume(stream)
	}

	async function* runContinue(results: ToolResult[]): AsyncIterable<ToolTurnEvent> {
		if (!conversationId) {
			throw new Error("No conversationId available for Mistral MCP continuation")
		}
		const resultInputs: FunctionResultEntry[] = results.map((result) => ({
			type: "function.result",
			toolCallId: result.callId,
			result: result.output
		}))
		const stream = await mistral.beta.conversations.appendStream({
			conversationId,
			conversationAppendStreamRequest: {
				inputs: resultInputs,
				store: false,
				stream: true
			}
		})
		yield* consume(stream)
	}

	return {
		start() {
			return runStart()
		},
		continueWith(results: ToolResult[]) {
			return runContinue(results)
		}
	}
}
