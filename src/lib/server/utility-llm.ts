import { env } from "$env/dynamic/private"
import { getVendor } from "$lib/server/ai-vendors"
import type { ChatConfig, ChatRequest, ChatResponseObject } from "$lib/types/chat"

// Bounds how long we'll wait on the utility model before giving up and letting the caller fall
// back to its non-rewritten/non-titled behavior. A hung or very slow backend (model not warmed
// up, KI-server misbehaving, ...) would otherwise block the caller indefinitely - this doesn't
// cancel the underlying HTTP call, just stops waiting on it, which is enough to keep a bad utility
// model from taking the whole RAG/chat flow down with it. Set generously high (60s) since a
// cold-start model load on the KI-server is a rare, one-time-per-restart event worth tolerating a
// long wait for - a warm call afterward is much faster and won't come close to this ceiling.
// Override via UTILITY_LLM_TIMEOUT_MS.
const UTILITY_TIMEOUT_MS = Number(env.UTILITY_LLM_TIMEOUT_MS) || 60_000

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
const UTILITY_MODEL = env.UTILITY_LLM_MODEL || "llama3:8b-instruct-q5_K_M"

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`Utility LLM call timed out after ${ms}ms`)), ms)
		promise.then(
			(value) => {
				clearTimeout(timer)
				resolve(value)
			},
			(error) => {
				clearTimeout(timer)
				reject(error)
			}
		)
	})
}

// Single entry point both utility call sites (query rewrite, conversation titles) go through -
// bounded by UTILITY_TIMEOUT_MS so a hung/slow backend can't block the caller indefinitely.
export function createUtilityChatResponse(request: ChatRequest): Promise<ChatResponseObject> {
	return withTimeout(getVendor("LITELLM").createChatResponse(request), UTILITY_TIMEOUT_MS)
}

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
