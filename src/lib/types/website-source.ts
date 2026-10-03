import z from "zod"

// A "website" DataSource (see chat.ts) references one of these by id. Unlike ragservice
// libraries, these are 100% Hugin-native - no external service, no vectorization. At chat time
// they become the allow-list for a browse_website function-tool (see
// $lib/server/website-tools) - the model can only fetch pages that match one of a source's
// entries, never arbitrary URLs.
export type WebsiteSourceEntry = {
	// A full URL. For "exact", the whole URL must match. For "prefix", the value's origin must
	// match and the requested URL's pathname must start with this value's pathname - so a prefix
	// can be a whole domain (value = the bare origin) or just a section of one (e.g. a "/buss/"
	// path).
	value: string
	matchType: "exact" | "prefix"
}

export type WebsiteSource = {
	_id: string
	name: string
	// "private" (default): only the creator (or an admin) can see, use, edit or delete it - never
	// listed for anyone else. "published": any employee can see it and select it for their own
	// bot, but only the creator or an admin can still edit/delete it. Mirrors ChatConfig's own
	// private/published + owner model (see canEditChatConfig/canUpdateChatConfig) - added after a
	// real incident: every MCP/website source was visible AND editable/deletable by every employee,
	// regardless of who created it, once this went out to a shared (not just single-developer)
	// environment.
	type: "private" | "published"
	entries: WebsiteSourceEntry[]
	createdBy: {
		id: string
		name?: string | undefined
	}
	createdAt: string
	updatedAt: string
}

export type NewWebsiteSource = Omit<WebsiteSource, "_id">

const isHttpUrl = (value: string): boolean => {
	try {
		const url = new URL(value)
		return url.protocol === "http:" || url.protocol === "https:"
	} catch {
		return false
	}
}

// Client-supplied fields only - name + entries. createdBy/createdAt/updatedAt are always set
// server-side (see api/website-sources), same split as NewChatConfig's created/updated.
export const WebsiteSourceInputSchema = z.object({
	name: z.string().min(1, "Navn er påkrevd"),
	type: z.enum(["private", "published"]),
	entries: z
		.array(
			z.object({
				value: z.string().refine(isHttpUrl, "Må være en gyldig http(s)-URL"),
				matchType: z.enum(["exact", "prefix"])
			})
		)
		.min(1, "Minst én URL må legges til")
})

export type WebsiteSourceInput = z.infer<typeof WebsiteSourceInputSchema>
