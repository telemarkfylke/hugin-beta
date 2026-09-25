import { canSeeSpotlight } from "./authorization"
import type { AppConfig, AppRoles, ModelInfo } from "./types/app-config"
import type { AuthenticatedPrincipal } from "./types/authentication"
import type { ChatConfig, VendorId } from "./types/chat"
import type { ClientModelProfile } from "./types/model-profiles"

// Client-safe helpers for model profiles (the picker, web search gating, display names). Pure, so
// they're unit-tested in tests/server/models/client-model-profiles.test.ts.

export type ProfileBadge = { icon: string; label: string; kind: "feature" | "location" }
export type ProfileSelection = { profile: string; vendorId: VendorId; model: string; project: string }
export type PinnedSelection = { vendorId: VendorId; model: string; project: string; pinned: { model: string; project: string } }

export const getProfileBadges = (profile: ClientModelProfile): ProfileBadge[] => {
	const badges: ProfileBadge[] = []
	if (profile.mimeTypes.FILE.length > 0) {
		badges.push({ icon: "📎", label: "Filer", kind: "feature" })
	}
	if (profile.mimeTypes.IMAGE.length > 0) {
		badges.push({ icon: "🖼️", label: "Bilder", kind: "feature" })
	}
	if (profile.capabilities.includes("webSearch")) {
		badges.push({ icon: "🌐", label: "Nettsøk", kind: "feature" })
	}
	if (profile.dataLocation) {
		badges.push({ icon: "📍", label: profile.dataLocation, kind: "location" })
	}
	return badges
}

// Cosmetic - the server enforces profile roles on save. The config's current profile stays visible so
// a co-editor who couldn't choose it themselves doesn't see an empty selection.
export const getSelectableProfiles = (profiles: ClientModelProfile[], user: AuthenticatedPrincipal, appRoles: AppRoles, currentProfileId: string | undefined): ClientModelProfile[] => {
	return profiles.filter((profile) => profile.id === currentProfileId || canSeeSpotlight(user, appRoles, profile.roles ?? ["all"]))
}

export const profileSelection = (profile: ClientModelProfile): ProfileSelection => ({
	profile: profile.id,
	vendorId: profile.vendorId,
	model: profile.model,
	project: profile.project
})

export const defaultProfileSelection = (appConfig: AppConfig, purpose: "CHAT" | "ASSISTANT"): ProfileSelection | null => {
	const profile = appConfig.MODEL_PROFILES.find((p) => p.id === appConfig.DEFAULT_PROFILE_IDS[purpose])
	return profile ? profileSelection(profile) : null
}

const findModelByKey = (appConfig: AppConfig, modelKey: string): { vendorId: VendorId; model: ModelInfo } | null => {
	for (const [vendorId, vendor] of Object.entries(appConfig.VENDORS)) {
		const model = vendor.MODELS.find((m) => m.KEY === modelKey)
		if (model) {
			return { vendorId: vendorId as VendorId, model }
		}
	}
	return null
}

export const pinnedSelection = (appConfig: AppConfig, modelKey: string, project: string): PinnedSelection | null => {
	const found = findModelByKey(appConfig, modelKey)
	if (!found) {
		return null
	}
	return { vendorId: found.vendorId, model: found.model.ID, project, pinned: { model: modelKey, project } }
}

export const getPinnableModels = (appConfig: AppConfig): { vendorId: VendorId; vendorName: string; models: ModelInfo[] }[] => {
	return Object.entries(appConfig.VENDORS)
		.filter(([_id, vendor]) => vendor.ENABLED)
		.map(([vendorId, vendor]) => ({ vendorId: vendorId as VendorId, vendorName: vendor.NAME, models: vendor.MODELS.filter((m) => !m.RETIRED) }))
		.filter((group) => group.models.length > 0)
}

export const supportsWebSearch = (config: ChatConfig, appConfig: AppConfig): boolean => {
	// Vendor agents have no model to look up - keep the vendor-level rule they had before capabilities existed
	if (config.vendorAgent) {
		return config.vendorId === "OPENAI" || config.vendorId === "MISTRAL"
	}
	if (!config.model) {
		return false
	}
	// config.vendorId may come from a stored/client config, so guard against prototype keys
	// (e.g. "constructor") before indexing the plain VENDORS object - see task 5's catalogue lookup fix.
	if (!Object.hasOwn(appConfig.VENDORS, config.vendorId)) {
		return false
	}
	const model = appConfig.VENDORS[config.vendorId].MODELS.find((m) => m.ID === config.model)
	return model?.CAPABILITIES.includes("webSearch") ?? false
}

export const getModelDisplayName = (config: Pick<ChatConfig, "profile" | "model">, appConfig: AppConfig): string => {
	const profile = config.profile ? appConfig.MODEL_PROFILES.find((p) => p.id === config.profile) : undefined
	if (profile) {
		return `${profile.icon} ${profile.label}`
	}
	return config.model ?? ""
}
