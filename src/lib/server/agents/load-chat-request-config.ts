import { supportsWebSearch } from "$lib/model-profiles"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, ChatTool } from "$lib/types/chat"
import { getFallbackAgent } from "./fallback-agent"
import { loadAgentForPrompt } from "./load-agent-for-prompt"

// /api/chat never trusts the config the client sends. Only two things are read from it:
//   _id   - which assistant; the config itself is loaded fresh from the DB (and authorized there).
//           "" means the home page's fallback assistant, which the server defines itself.
//   tools - the user's per-message toggles in ChatInput (web search, data sources). Treated as a
//           wish, granted only where the SAVED assistant can actually do it.
// Everything else the client sent (model, pin, instructions, dataSources, ...) is ignored, so a
// crafted request can't pick a model, a project/API key or a data source the assistant doesn't have.
export const loadChatRequestConfig = async (clientConfig: unknown, user: AuthenticatedPrincipal): Promise<ChatConfig> => {
	const requested = typeof clientConfig === "object" && clientConfig !== null ? (clientConfig as { _id?: unknown; tools?: unknown }) : {}
	const configId = typeof requested._id === "string" ? requested._id : ""

	// loadAgentForPrompt 404s an unknown id and 403s one the user may not prompt
	const config = configId ? await loadAgentForPrompt(user, configId) : getFallbackAgent()

	const requestedTools = Array.isArray(requested.tools) ? requested.tools : []
	const wants = (type: ChatTool["type"]) => requestedTools.some((tool) => typeof tool === "object" && tool !== null && (tool as { type?: unknown }).type === type)
	const dataSources = config.dataSources ?? []

	const tools: ChatTool[] = []
	if (wants("web_search") && supportsWebSearch(config, APP_CONFIG)) tools.push({ type: "web_search" })
	if (wants("datasource") && dataSources.some((s) => s.type === "ragservice" || s.type === "website")) tools.push({ type: "datasource" })
	if (wants("mcp") && dataSources.some((s) => s.type === "mcp")) tools.push({ type: "mcp" })

	return { ...config, tools }
}
