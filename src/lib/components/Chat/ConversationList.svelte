<script lang="ts">
	import type { ChatState } from "./ChatState.svelte"

	type ConversationSummary = {
		id: string
		owner: string
		summary?: string
		createdAt: string
		updatedAt: string
	}

	type MenuState = "closed" | "open"

	type Props = {
		chatState: ChatState
	}

	let { chatState = $bindable() }: Props = $props()

	let menuState: MenuState = $state("closed")
	let conversations: ConversationSummary[] = $state([])
	let loading = $state(false)
	let container: HTMLDivElement

	function handleOutsideClick(event: MouseEvent) {
		if (menuState !== "closed" && !container.contains(event.target as Node)) {
			menuState = "closed"
		}
	}

	const formatDate = (isoDate: string): string => {
		return new Date(isoDate).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })
	}

	const loadConversations = async () => {
		loading = true
		try {
			const result = await fetch("/api/conversations")
			if (!result.ok) {
				throw new Error(`Failed to load conversations: ${result.status} ${result.statusText}`)
			}
			conversations = await result.json()
		} catch (error) {
			console.error("Error loading conversations:", error)
		} finally {
			loading = false
		}
	}

	const toggleMenu = async () => {
		if (menuState === "open") {
			menuState = "closed"
			return
		}
		menuState = "open"
		await loadConversations()
	}

	const openConversation = async (conversationId: string) => {
		menuState = "closed"
		await chatState.loadChat(conversationId)
	}

	const deleteConversation = async (conversationId: string) => {
		try {
			const result = await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" })
			if (!result.ok) {
				throw new Error(`Failed to delete conversation: ${result.status} ${result.statusText}`)
			}
			conversations = conversations.filter((c) => c.id !== conversationId)
			if (chatState.chat._id === conversationId) {
				chatState.newChat()
			}
		} catch (error) {
			console.error("Error deleting conversation:", error)
		}
	}
</script>

<svelte:document onclick={handleOutsideClick} />

<div class="splitbutton" bind:this={container}>
	<button onclick={toggleMenu} class="header-action" title="Tidligere samtaler">
		<span class="material-symbols-rounded">history</span>
		Samtaler
	</button>
	{#if menuState === "open"}
		<div class="splitmenu">
			{#if loading}
				<div class="menu-status">Laster...</div>
			{:else if conversations.length === 0}
				<div class="menu-status">Ingen lagrede samtaler</div>
			{:else}
				{#each conversations as conversation (conversation.id)}
					<div class="conversation-row">
						<button class="conversation-open" onclick={() => openConversation(conversation.id)}>
							{formatDate(conversation.updatedAt)}
						</button>
						<button class="icon-button conversation-delete" title="Slett samtale" onclick={() => deleteConversation(conversation.id)}>
							<span class="material-symbols-rounded">delete</span>
						</button>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.splitbutton {
		position: relative;
		display: inline-block;
	}
	.splitmenu {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
		background: white;
		border: 1px solid var(--color-primary-30);
		border-radius: 8px;
		z-index: 10;
		min-width: 14rem;
		max-height: 20rem;
		overflow-y: auto;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
	}
	.menu-status {
		padding: 0.75rem 1rem;
		font-size: smaller;
		color: var(--color-primary-70);
	}
	.conversation-row {
		display: flex;
		align-items: center;
		border-bottom: 1px solid var(--color-primary-10);
	}
	.conversation-row:last-child {
		border-bottom: none;
	}
	.conversation-open {
		flex: 1;
		border: none;
		border-radius: 0;
		background: none;
		padding: 0.6rem 1rem;
		text-align: left;
		color: var(--color-primary);
	}
	.conversation-open:hover {
		background-color: var(--color-primary-10);
	}
	.conversation-delete {
		padding: 0.5rem;
		margin-right: 0.25rem;
	}
</style>
