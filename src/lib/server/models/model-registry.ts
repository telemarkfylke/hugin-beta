import { env } from "$env/dynamic/private"
import { MODEL_CONTEXT } from "$lib/server/app-config/app-config"
import { isResolvedModelAvailable, type ModelSelection, type ResolvedModel, resolveChatConfig, resolveDefaultModel } from "./resolve"

// The real-config bindings of resolve.ts. Server code should import from here; tests use resolve.ts with fixtures.
export const resolveConfig = <T extends ModelSelection>(config: T): T => resolveChatConfig(config, MODEL_CONTEXT)

export const isModelAvailable = (config: Pick<ModelSelection, "vendorId" | "vendorAgent">): boolean => isResolvedModelAvailable(config, MODEL_CONTEXT)

// User-facing text for the 503 the chat routes answer when isModelAvailable is false
export const MODEL_UNAVAILABLE_MESSAGE = "Modellen for denne assistenten er ikke tilgjengelig akkurat nå"

export const getDefaultModel = (purpose: "chat" | "assistant" | "canvas" | "utility"): ResolvedModel | null => {
	const resolved = resolveDefaultModel(purpose, MODEL_CONTEXT)
	// Kept from utility-llm.ts: the KI-server's allow-list is managed separately, so ops can swap the utility model without a deploy
	if (resolved && purpose === "utility" && env.UTILITY_LLM_MODEL) {
		return { ...resolved, model: env.UTILITY_LLM_MODEL }
	}
	return resolved
}
