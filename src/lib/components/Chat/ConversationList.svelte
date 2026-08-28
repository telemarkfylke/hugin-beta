<script lang="ts">
	import type { ChatState } from "./ChatState.svelte"

	type ConversationSummary = {
		id: string
		owner: string
		title?: string
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
	let editingId: string | null = $state(null)
	let editingTitle = $state("")
	let renameInput: HTMLInputElement | undefined = $state()

	function handleOutsideClick(event: MouseEvent) {
		// Use composedPath() rather than container.contains(event.target) - clicking "rediger" swaps
		// the button for an input synchronously (before this document-level handler runs), so by the
		// time we get here event.target is already detached from the DOM and .contains() on it always
		// comes back false, closing the menu right as editing starts. composedPath() is a snapshot of
		// the path taken at dispatch time, so it stays correct even if the target node was removed.
		if (menuState !== "closed" && !event.composedPath().includes(container)) {
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

	const startEditing = (conversation: ConversationSummary) => {
		editingId = conversation.id
		editingTitle = conversation.title ?? ""
	}

	const cancelEditing = () => {
		editingId = null
		editingTitle = ""
	}

	const saveEditing = async () => {
		const conversationId = editingId
		const title = editingTitle.trim()
		if (!conversationId || !title) {
			cancelEditing()
			return
		}

		try {
			const result = await fetch(`/api/conversations/${conversationId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title })
			})
			if (!result.ok) {
				throw new Error(`Failed to rename conversation: ${result.status} ${result.statusText}`)
			}
			const data: { title: string } = await result.json()
			const conversation = conversations.find((c) => c.id === conversationId)
			if (conversation) {
				conversation.title = data.title
			}
			if (chatState.chat._id === conversationId) {
				chatState.chat.title = data.title
			}
		} catch (error) {
			console.error("Error renaming conversation:", error)
		} finally {
			cancelEditing()
		}
	}

	const handleEditKeydown = (event: KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault()
			saveEditing()
		} else if (event.key === "Escape") {
			event.preventDefault()
			cancelEditing()
		}
	}

	$effect(() => {
		if (editingId) {
			renameInput?.focus()
			renameInput?.select()
		}
	})

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
						{#if editingId === conversation.id}
							<input
								class="conversation-rename-input"
								type="text"
								bind:value={editingTitle}
								bind:this={renameInput}
								onkeydown={handleEditKeydown}
								onblur={saveEditing}
								maxlength="200"
							/>
						{:else}
							<button class="conversation-open" onclick={() => openConversation(conversation.id)} title={formatDate(conversation.updatedAt)}>
								{conversation.title ?? formatDate(conversation.updatedAt)}
							</button>
							<button class="icon-button conversation-rename" title="Endre navn" onclick={() => startEditing(conversation)}>
								<span class="material-symbols-rounded">edit</span>
							</button>
							<button class="icon-button conversation-delete" title="Slett samtale" onclick={() => deleteConversation(conversation.id)}>
								<span class="material-symbols-rounded">delete</span>
							</button>
						{/if}
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
		width: max-content;
		min-width: 20rem;
		max-width: 28rem;
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
		min-width: 0;
		border: none;
		border-radius: 0;
		background: none;
		padding: 0.6rem 1rem;
		text-align: left;
		color: var(--color-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.conversation-open:hover {
		background-color: var(--color-primary-10);
	}
	.conversation-rename,
	.conversation-delete {
		padding: 0.5rem;
		margin-right: 0.25rem;
	}
	.conversation-rename-input {
		flex: 1;
		min-width: 0;
		border: 1px solid var(--color-primary-30);
		border-radius: 4px;
		background: none;
		padding: 0.5rem 0.75rem;
		margin: 0.25rem 0.5rem;
		color: var(--color-primary);
		font: inherit;
	}
</style>
