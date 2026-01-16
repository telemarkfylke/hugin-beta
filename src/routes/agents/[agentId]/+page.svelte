<script lang="ts">
	import ChatComponent from "$lib/components/Chat/Chat.svelte"
	import { ChatState } from "$lib/components/Chat/ChatState.svelte"
	import type { Chat } from "$lib/types/chat"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()

	const initialChat: Chat = {
		id: "",
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
</script>
  <ChatComponent chatState={agentChatState} />
<style>
  
</style>