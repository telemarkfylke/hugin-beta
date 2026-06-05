import { createOpenAI } from "@ai-sdk/openai"
import { env } from "$env/dynamic/private"
import type { Tool } from "ai"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { ChatConfig, ChatTool } from "$lib/types/chat"

const getApiKey = (prefix: string, project: string): string => {
	const key = env[`${prefix}_API_KEY_PROJECT_${project}`]
	if (!key) throw new HTTPError(500, `Missing API key: ${prefix}_API_KEY_PROJECT_${project}`)
	return key
}

export const resolveTools = (tools: ChatTool[] | null | undefined, config: ChatConfig): Record<string, Tool> | undefined => {
	if (!tools || tools.length === 0) return undefined
	const resolved: Record<string, Tool> = {}
	for (const tool of tools) {
		if (tool.type === "web_search") {
			const openai = createOpenAI({ apiKey: getApiKey("OPENAI", config.project) })
			resolved.webSearch = openai.tools.webSearch()
		}
	}
	return Object.keys(resolved).length > 0 ? resolved : undefined
}
