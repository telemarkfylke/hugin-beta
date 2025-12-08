<script lang="ts">
	import type { VendorConversation } from "$lib/types/conversation"
	import { IVendorResults } from "$lib/types/vendors"

	type FrontendConversations = {
		isLoading: boolean
		error: string | null
		value: VendorConversation[]
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
			const result = IVendorResults.ListConversationsResult.parse(await res.json()) // Validate response
			conversations.value = result.vendorConversations
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
			conversations.value = conversations.value.filter((conversation) => !(conversation.vendorId === vendorId && conversation.id === conversationId))
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
        <li id="conversation-{conversation.vendorId}-{conversation.id}">
          <a id="conversation-link-{conversation.vendorId}-{conversation.id}" href="/conversations/{conversation.vendorId}/{conversation.id}">{conversation.title} {conversation.vendorId} - {conversation.createdAt}</a>
          <button id="conversation-delete-{conversation.vendorId}-{conversation.id}" onclick={(event: Event) => deleteConversation(event, conversation.vendorId, conversation.id)}>Delete</button>
        </li>
      {/each}
    </ul>
  {/if}
{/if}