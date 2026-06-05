import { openai } from "@ai-sdk/openai"
import type { Tool } from "ai"
import type { ChatConfig, ChatTool } from "$lib/types/chat"

export const resolveTools = (tools: ChatTool[] | null | undefined, vendorId: ChatConfig["vendorId"]): Record<string, Tool> | undefined => {
	if (!tools || tools.length === 0) {
		return undefined
	}

	const resolved: Record<string, Tool> = {}

	for (const tool of tools) {
		if (tool.type === "web_search") {
			switch (vendorId) {
				case "OPENAI":
					resolved.webSearch = openai.tools.webSearch()
					break
				case "MISTRAL":
					resolved.webSearch = openai.tools.webSearch()
					break
			}
		}
	}

	return Object.keys(resolved).length > 0 ? resolved : undefined
}
