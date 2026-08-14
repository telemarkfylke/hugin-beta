import { env } from "$env/dynamic/private"
import { getVendor } from "$lib/server/ai-vendors"
import type { ChatConfig } from "$lib/types/chat"

// Model used for small, mechanical text tasks (RAG query rewriting, conversation titles, ...)
// that don't need the (often large/expensive) model the user's own chat is configured with, and
// don't benefit from extended reasoning. Runs through the LITELLM vendor (the KI-server gateway
// that wraps the server's Ollama instance) rather than the native OLLAMA vendor, which is no
// longer the real path to Ollama in this environment. The `ollama_chat/` prefix tells LiteLLM to
// call Ollama's /api/chat (multi-turn, chat-shaped) rather than /api/generate (flat single-prompt
// completion) - the right choice since all our conversation data is structured multi-turn
// messages. Whatever model you put here (default or override) must also be added to the KI-
// server's own model allow-list (a separate .env on that server) before it's actually reachable.
// Override via UTILITY_LLM_MODEL - include the `ollama_chat/` (or other) prefix yourself, since
// this isn't necessarily an Ollama-backed model forever. Avoid "thinking"/reasoning model variants
// here - the extra reasoning pass is wasted latency for a task this simple.
const UTILITY_MODEL = env.UTILITY_LLM_MODEL || "ollama_chat/llama3:8b-instruct-q5_K_M"

export const getUtilityVendor = () => getVendor("LITELLM")

// Minimal, throwaway ChatConfig for a utility completion - never persisted or shown to a user,
// just a vehicle to get a plain completion out of the dedicated utility model/vendor.
export function buildUtilityConfig(instructions: string): ChatConfig {
	const now = new Date().toISOString()
	return {
		_id: "utility-llm",
		name: "Internal utility model",
		description: "Internal utility config for small mechanical text tasks (query rewriting, conversation titles, ...)",
		vendorId: "LITELLM",
		project: "DEFAULT",
		model: UTILITY_MODEL,
		instructions,
		type: "private",
		accessGroups: [],
		created: { at: now, by: { id: "system" } },
		updated: { at: now, by: { id: "system" } }
	}
}
