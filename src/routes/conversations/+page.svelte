<script lang="ts">
	import { GetConversationsResponse } from "$lib/types/api-responses"
	import type { DBConversation } from "$lib/types/conversation"

	type FrontendConversations = {
		isLoading: boolean
		error: string | null
		value: DBConversation[]
	}

	let conversations: FrontendConversations = $state({
		isLoading: false,
		error: null,
		value: []
	})

	const getConversations = async () => {
		conversations.isLoading = true
		conversations.error = null
		conversations.value = []
		try {
			const res = await fetch("/api/conversations")
			if (!res.ok) {
				throw new Error(`Failed to fetch conversations: ${res.statusText}`)
			}
			// get json and validate
			const result = GetConversationsResponse.parse(await res.json())
			conversations.value = result.conversations
		} catch (error) {
			conversations.error = error instanceof Error ? error.message : String(error)
		}
		conversations.isLoading = false
	}

	const deleteConversation = async (event: Event, vendorId: string, conversationId: string) => {
		// Set eventTarget to disabled and loading
		const buttonTarget = event.target as HTMLButtonElement
		const originalText = buttonTarget.textContent
		buttonTarget.disabled = true
		buttonTarget.textContent = "Deleting..."
		try {
			const res = await fetch(`/api/conversations/${vendorId}/${conversationId}`, {
				method: "DELETE"
			})
			if (!res.ok) {
				throw new Error(`Failed to delete vector store: ${res.statusText}`)
			}
			// Filter out the deleted vector store from the list
			conversations.value = conversations.value.filter((conversation) => !(conversation.vendorId === vendorId && conversation._id === conversationId))
			console.log("Conversation deleted successfully")
		} catch (error) {
			console.error("Error deleting conversation:", error)
		}
		// Svelte has something funny - the element below the one with delete inherits the button somehow - so we need to enable it again...
		buttonTarget.disabled = false
		buttonTarget.textContent = originalText
	}

	// Then get them
	getConversations()
</script>

<h1>Conversations Page</h1>
{#if conversations.isLoading}
  <p>Loading vector stores...</p>
{:else if conversations.error}
  <p style="color: red;">Error: {conversations.error}</p>
{:else}
  {#if conversations.value.length === 0}
    <p>No conversations found.</p>
  {:else}
    <ul>
      {#each conversations.value as conversation}
        <li id="conversation-{conversation.vendorId}-{conversation._id}">
          <a id="conversation-link-{conversation.vendorId}-{conversation._id}" href="/agents/{conversation.agentId}?conversationId={conversation._id}">{conversation.name} {conversation.vendorId} - {conversation.createdAt}</a>
          <button id="conversation-delete-{conversation.vendorId}-{conversation._id}" onclick={(event: Event) => deleteConversation(event, conversation.vendorId, conversation._id)}>Delete</button>
        </li>
      {/each}
    </ul>
  {/if}
{/if}