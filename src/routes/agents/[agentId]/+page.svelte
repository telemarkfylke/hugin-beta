<script lang="ts">
	import { page } from "$app/state"
	import ChatComponent from "$lib/components/Chat/Chat.svelte"
	import { ChatState } from "$lib/components/Chat/ChatState.svelte"
	import type { Chat } from "$lib/types/chat"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()

	// svelte-ignore state_referenced_locally (initial page data is used to create the initial ChatState; route updates are handled below)
	const initialChat: Chat = {
		_id: "",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		owner: {
			id: data.authenticatedUser.userId,
			name: data.authenticatedUser.name
		},
		config: data.agent,
		history: []
	}

	// svelte-ignore state_referenced_locally (authenticated user and app config are stable for this page instance)
	const agentChatState = new ChatState(initialChat, data.authenticatedUser, data.APP_CONFIG)

	// Get url param agentId and update chat config when it changes
	$effect(() => {
		console.log("Agent ID changed:", page.params.agentId)
		page.params.agentId
		const initialChat: Chat = {
			_id: "",
			createdAt: "",
			updatedAt: "",
			owner: {
				id: data.authenticatedUser.userId,
				name: data.authenticatedUser.name
			},
			config: data.agent,
			history: []
		}
		agentChatState.changeChat(initialChat)
	})
</script>
  <ChatComponent chatState={agentChatState} />
<style>
  
</style>