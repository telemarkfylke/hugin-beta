import type { RoleAccessGroups, VendorId } from "./chat"

// Profiles always run on this vendor project; only an admin pin can choose another
export const DEFAULT_PROJECT_ID = "DEFAULT"

// Capabilities the UI and request builders gate on. Add a value only once something reads it.
export type ModelCapability = "webSearch"

export type MimeTypes = { FILE: string[]; IMAGE: string[] }

// A model profile as sent to the browser (APP_CONFIG.MODEL_PROFILES). Only profiles whose vendor is
// enabled are included. vendorId/model/project are the profile's resolved values, so the editor can
// update mime types and capabilities as soon as the user switches profile - the server re-resolves
// on every request regardless (see $lib/server/models/resolve.ts).
export type ClientModelProfile = {
	id: string
	label: string
	icon: string
	description: string
	dataLocation?: string | undefined
	roles?: RoleAccessGroups[] | undefined
	vendorId: VendorId
	model: string
	project: string
	capabilities: ModelCapability[]
	mimeTypes: MimeTypes
}
