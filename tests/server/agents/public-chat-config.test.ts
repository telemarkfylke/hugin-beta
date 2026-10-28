import { describe, expect, it } from "vitest"
import { toPublicChatConfig } from "$lib/server/agents/public-chat-config"
import type { ChatConfig } from "$lib/types/chat"

const config: ChatConfig = {
	_id: "cfg-1",
	name: "Bot",
	description: "Svarer om skoleskyss",
	vendorId: "MISTRAL",
	project: "DEFAULT",
	profile: "europeisk",
	model: "mistral-large-latest",
	instructions: "Hemmelig oppsett",
	tools: [{ type: "web_search" }],
	dataSources: [
		{ type: "ragservice", id: "store-1" },
		{ type: "mcp", sourceId: "mcp-1" }
	],
	type: "published",
	allowAnonymousEmbed: true,
	categories: ["Skyss"],
	welcomeMessage: "Hei",
	suggestedQuestions: ["Når går bussen?"],
	showAttachmentButton: false,
	scopeGuardEnabled: true,
	rateLimitPerIpPerDay: 50,
	accessGroups: [{ id: "group-oid", displayName: "Gruppe" }],
	created: { at: "2026-10-01", by: { id: "creator-oid", name: "Kari" } },
	updated: { at: "2026-10-02", by: { id: "editor-oid", name: "Ola" } }
}

describe("toPublicChatConfig - what an anonymous embed visitor gets", () => {
	const visible = JSON.stringify(toPublicChatConfig(config))

	it("leaves out instructions, people, groups, store ids and limits", () => {
		for (const secret of ["Hemmelig oppsett", "creator-oid", "Kari", "editor-oid", "Ola", "group-oid", "store-1", "mcp-1", "Skyss", "rateLimit", "scopeGuard"]) {
			expect(visible).not.toContain(secret)
		}
	})

	it("keeps what the widget needs", () => {
		expect(toPublicChatConfig(config)).toMatchObject({
			_id: "cfg-1",
			name: "Bot",
			model: "mistral-large-latest",
			welcomeMessage: "Hei",
			suggestedQuestions: ["Når går bussen?"],
			showAttachmentButton: false,
			dataSources: [{ type: "ragservice" }, { type: "mcp" }]
		})
	})
})
