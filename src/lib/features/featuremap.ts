import { env } from "$env/dynamic/private"
import { checkFeatureMap } from "./service"
export type FeatureKey = "TRANSCRIPTION" | "IMPORT_EXPORT" | "LOCAL_MODELS"
export type FeatureMap = {
	TRANSCRIPTION?: boolean
	IMPORT_EXPORT?: boolean
	LOCAL_MODELS?: boolean
}

const features: string[] = (env.FEATURES || "").toUpperCase().split(";")

const featureMap: FeatureMap = {
	TRANSCRIPTION: features.includes("TRANSCRIPTION"),
	IMPORT_EXPORT: features.includes("IMPORT_EXPORT"),
	LOCAL_MODELS: features.includes("LOCAL_MODELS")
}

export function checkFeature(feature: FeatureKey): boolean {
	const map = getFeatureMap()
	return checkFeatureMap(feature, map)
}

export function getFeatureMap(): FeatureMap {
	return featureMap
}
