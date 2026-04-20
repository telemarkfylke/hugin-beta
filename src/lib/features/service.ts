import type { FeatureKey, FeatureMap } from "./featuremap"

export async function getFeatures(): Promise<FeatureMap> {
	const featuresResponse = await fetch("/api/features")
	if (!featuresResponse.ok) {
		throw new Error("Failed to fetch features")
	}
	const featuresData = (await featuresResponse.json()) as FeatureMap
	return featuresData
}

export function checkFeatureMap(feature: FeatureKey, map: FeatureMap): boolean {
	if (map[feature]) return map[feature]
	return false
}
