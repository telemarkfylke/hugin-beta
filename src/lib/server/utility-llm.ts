import { env } from "$env/dynamic/private"
import { getVendor } from "$lib/server/ai-vendors"
import { getDefaultModel } from "$lib/server/models/model-registry"
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
	return withTimeout(getVendor(request.config.vendorId).createChatResponse(request), UTILITY_TIMEOUT_MS)
}

// Minimal, throwaway ChatConfig for a utility completion - never persisted or shown to a user,
// just a vehicle to get a plain completion out of the dedicated utility model/vendor.
export function buildUtilityConfig(instructions: string): ChatConfig {
	const utility = getDefaultModel("utility")
	if (!utility) {
		throw new Error("No utility model configured - see DEFAULTS.utility in models.config.ts")
	}
	const now = new Date().toISOString()
	return {
		_id: "utility-llm",
		name: "Internal utility model",
		description: "Internal utility config for small mechanical text tasks (query rewriting, conversation titles, ...)",
		vendorId: utility.vendorId,
		project: utility.project,
		model: utility.model,
		instructions,
		type: "private",
		accessGroups: [],
		created: { at: now, by: { id: "system" } },
		updated: { at: now, by: { id: "system" } }
	}
}
