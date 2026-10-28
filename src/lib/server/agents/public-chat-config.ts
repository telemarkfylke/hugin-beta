import type { ChatConfig, DataSource } from "$lib/types/chat"

// Only the store/source ids are dropped - the type is all the client reads (which tool buttons apply)
const publicDataSource = (source: DataSource): DataSource => (source.type === "mcp" ? { type: "mcp", sourceId: "" } : { type: source.type, id: "" })

// What an anonymous embed visitor may see of an assistant: enough for the widget (name, welcome text,
// buttons, which file types the model takes) and nothing else - no instructions, authors, access
// groups, store ids or limits. Everything the chat route acts on comes from the DB, never from this.
export const toPublicChatConfig = (config: ChatConfig): ChatConfig => ({
	_id: config._id,
	name: config.name,
	description: config.description,
	vendorId: config.vendorId,
	project: config.project,
	vendorAgent: config.vendorAgent,
	model: config.model,
	profile: config.profile,
	tools: config.tools,
	dataSources: config.dataSources?.map(publicDataSource),
	type: config.type,
	allowAnonymousEmbed: config.allowAnonymousEmbed,
	avatarUrl: config.avatarUrl,
	welcomeMessage: config.welcomeMessage,
	suggestedQuestions: config.suggestedQuestions,
	showAttachmentButton: config.showAttachmentButton,
	showWebSearchButton: config.showWebSearchButton,
	accessGroups: [],
	created: { at: config.created.at, by: { id: "" } },
	updated: { at: config.updated.at, by: { id: "" } }
})
