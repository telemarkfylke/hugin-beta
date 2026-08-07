<script lang="ts">
	import { replaceState } from "$app/navigation"
	import { page } from "$app/state"
	import ChatComponent from "$lib/components/Chat/Chat.svelte"
	import { ChatState } from "$lib/components/Chat/ChatState.svelte"
	import type { Chat } from "$lib/types/chat"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()

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

	const agentChatState = new ChatState(initialChat, data.authenticatedUser, data.APP_CONFIG)

	// Track which agent the current chat belongs to, so we only reset on a real
	// agentId change — not on every `data` update (e.g. invalidateAll() on tab
	// refocus, which would otherwise wipe the in-progress conversation).
	let loadedAgentId = $state(page.params.agentId)

	// Reset the chat only when the url param agentId actually changes
	$effect(() => {
		const agentId = page.params.agentId
		if (agentId !== loadedAgentId) {
			loadedAgentId = agentId
			const newChat: Chat = {
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
			agentChatState.changeChat(newChat)
		}

		// Picked up after LoadConversationDialog sends us here to resume a conversation as this
		// agent - runs after the reset above so the loaded conversation wins, not the blank chat.
		const pendingConversationId = page.url.searchParams.get("loadConversation")
		if (pendingConversationId) {
			agentChatState.loadChat(pendingConversationId)
			replaceState(page.url.pathname, {})
		}
	})
</script>
  <ChatComponent chatState={agentChatState} />
<style>
  
</style>