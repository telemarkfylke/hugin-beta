import type { ModelConfig } from "./types"

// Run once at startup (app-config.ts). A broken models.config.ts should stop a deploy, not surface
// as a confusing runtime error on the first chat request.
export const assertModelConfig = (config: ModelConfig): void => {
	const problems: string[] = []
	const profileIds = new Set<string>()

	for (const profile of config.PROFILES) {
		if (profileIds.has(profile.id)) {
			problems.push(`Duplicate profile id "${profile.id}"`)
		}
		profileIds.add(profile.id)
		const model = config.MODELS[profile.model]
		if (!model) {
			problems.push(`Profile "${profile.id}" points to unknown model "${profile.model}"`)
		} else if (model.status === "retired") {
			problems.push(`Profile "${profile.id}" points to retired model "${profile.model}"`)
		} else if (model.internal) {
			problems.push(`Profile "${profile.id}" points to internal model "${profile.model}"`)
		}
	}

	for (const purpose of ["chat", "assistant", "canvas"] as const) {
		if (!profileIds.has(config.DEFAULTS[purpose])) {
			problems.push(`DEFAULTS.${purpose} "${config.DEFAULTS[purpose]}" is not a profile id`)
		}
	}

	const utility = config.MODELS[config.DEFAULTS.utility]
	if (!utility) {
		problems.push(`DEFAULTS.utility "${config.DEFAULTS.utility}" points to unknown model`)
	} else if (!utility.internal) {
		problems.push(`DEFAULTS.utility "${config.DEFAULTS.utility}" must point to an internal model`)
	}

	for (const [providerModel, profileId] of Object.entries(config.LEGACY)) {
		if (!profileIds.has(profileId)) {
			problems.push(`LEGACY["${providerModel}"] points to unknown profile "${profileId}"`)
		}
	}

	if (problems.length > 0) {
		throw new Error(`Invalid models.config.ts:\n- ${problems.join("\n- ")}`)
	}
}
