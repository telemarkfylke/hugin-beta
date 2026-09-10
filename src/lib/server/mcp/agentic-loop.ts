import { logger } from "@vestfoldfylke/loglady"
import { createSse } from "$lib/streaming"
import type { ChatResponseUsage } from "$lib/types/chat"
import type { McpClient } from "./mcp-client"

export type ToolTurnEvent =
	| { type: "text_delta"; itemId: string; content: string }
	| { type: "tool_call"; callId: string; toolName: string; arguments: string }
	| { type: "usage"; usage: ChatResponseUsage }

export type ToolResult = { callId: string; toolName: string; output: string; isError: boolean }

export interface ToolTurnDriver {
	start(): AsyncIterable<ToolTurnEvent>
	continueWith(results: ToolResult[]): AsyncIterable<ToolTurnEvent>
}

type PendingCall = { callId: string; toolName: string; arguments: string }

const DEFAULT_MAX_ITERATIONS = 5

export const runMcpAgenticLoop = (driver: ToolTurnDriver, mcpClient: McpClient, options?: { maxIterations?: number }): ReadableStream<Uint8Array> => {
	const maxIterations = options?.maxIterations ?? DEFAULT_MAX_ITERATIONS

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			const accumulatedUsage: ChatResponseUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
			try {
				let turn = driver.start()
				for (let iteration = 0; ; iteration++) {
					const pendingCalls: PendingCall[] = []

					for await (const event of turn) {
						if (event.type === "text_delta") {
							controller.enqueue(createSse({ event: "response.output_text.delta", data: { itemId: event.itemId, content: event.content } }))
						} else if (event.type === "tool_call") {
							controller.enqueue(createSse({ event: "response.tool_call", data: { itemId: event.callId, toolName: event.toolName } }))
							pendingCalls.push({ callId: event.callId, toolName: event.toolName, arguments: event.arguments })
						} else if (event.type === "usage") {
							accumulatedUsage.inputTokens += event.usage.inputTokens
							accumulatedUsage.outputTokens += event.usage.outputTokens
							accumulatedUsage.totalTokens += event.usage.totalTokens
						}
					}

					if (pendingCalls.length === 0) {
						break
					}

					if (iteration + 1 >= maxIterations) {
						logger.warn("[agentic-loop] Hit max iterations: {max}", maxIterations)
						// Any response.tool_call already emitted above for this turn's pendingCalls is
						// intentionally left without a matching response.tool_result - we break before
						// executing them. The stream still closes cleanly via response.done right after,
						// so downstream consumers must not treat an unresolved tool_call as an error.
						break
					}

					const results: ToolResult[] = []
					for (const call of pendingCalls) {
						const result = await executeToolCall(mcpClient, call)
						results.push(result)
						controller.enqueue(createSse({ event: "response.tool_result", data: { itemId: call.callId, toolName: call.toolName, status: result.isError ? "error" : "ok" } }))
					}

					turn = driver.continueWith(results)
				}

				controller.enqueue(createSse({ event: "response.done", data: { usage: accumulatedUsage } }))
				controller.close()
			} catch (error) {
				logger.errorException(error, "[agentic-loop] Agentic loop failed")
				const message = error instanceof Error ? error.message : "Unknown error"
				controller.enqueue(createSse({ event: "response.error", data: { code: "mcp_loop_error", message } }))
				controller.close()
			}
		}
	})
}

const executeToolCall = async (mcpClient: McpClient, call: PendingCall): Promise<ToolResult> => {
	let parsedArgs: Record<string, unknown>
	try {
		parsedArgs = call.arguments.trim().length > 0 ? (JSON.parse(call.arguments) as Record<string, unknown>) : {}
	} catch {
		return { callId: call.callId, toolName: call.toolName, output: `Invalid tool arguments JSON: ${call.arguments}`, isError: true }
	}
	try {
		const output = await mcpClient.callTool(call.toolName, parsedArgs)
		return { callId: call.callId, toolName: call.toolName, output, isError: false }
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown tool error"
		// The response.tool_result SSE event only ever carries an ok/error status (see below), not
		// the reason - without this, diagnosing a failed call means guessing whether it was a scope
		// rejection (createScopedSharePointClient/website-tool-client's own thrown errors) or a real
		// upstream failure (SharePoint/website unreachable, folder renamed mid-test, etc.). Logging
		// the exact arguments the model sent is what actually answers "why did it look there" -
		// there's no other place these are visible.
		logger.warn("[agentic-loop] Tool call failed: {name}({arguments}) - {message}", call.toolName, call.arguments, message)
		return { callId: call.callId, toolName: call.toolName, output: `Tool execution failed: ${message}`, isError: true }
	}
}
