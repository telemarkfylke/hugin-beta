import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, NewChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import type { ModelSelection } from "./resolve"

type Resolve = <T extends ModelSelection>(config: T) => T

// Every config going into or out of the store has vendorId/model/project filled in from its model
// profile (see resolve.ts). Wrapping the store means page loads, the agents list and the public embed
// endpoint can't forget to resolve. Pre-profile assistants get `profile` persisted on their next save.
export class ResolvingChatConfigStore implements IChatConfigStore {
	private readonly inner: IChatConfigStore
	private readonly resolve: Resolve

	constructor(inner: IChatConfigStore, resolve: Resolve) {
		this.inner = inner
		this.resolve = resolve
	}

	async getChatConfig(configId: string): Promise<ChatConfig | null> {
		const config = await this.inner.getChatConfig(configId)
		return config ? this.resolve(config) : null
	}

	async getChatConfigs(principal: AuthenticatedPrincipal): Promise<ChatConfig[]> {
		const configs = await this.inner.getChatConfigs(principal)
		return configs.map((config) => this.resolve(config))
	}

	async createChatConfig(chatConfig: NewChatConfig): Promise<ChatConfig> {
		return this.resolve(await this.inner.createChatConfig(this.resolve(chatConfig)))
	}

	async replaceChatConfig(configId: string, chatConfig: NewChatConfig): Promise<ChatConfig> {
		return this.resolve(await this.inner.replaceChatConfig(configId, this.resolve(chatConfig)))
	}

	deleteChatConfig(configId: string): Promise<void> {
		return this.inner.deleteChatConfig(configId)
	}
}
