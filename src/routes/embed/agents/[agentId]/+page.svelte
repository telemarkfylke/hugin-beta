<script lang="ts">
	import { ChatState } from "$lib/components/Chat/ChatState.svelte"
	import EmbedChat from "$lib/components/Chat/EmbedChat.svelte"
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

	// Real authenticated user, default /api/chat endpoint, normal storeChat behavior - only the
	// rendering (EmbedChat instead of Chat.svelte, no Menu chrome) differs from /agents/[agentId].
	const embedChatState = new ChatState(initialChat, data.authenticatedUser, data.APP_CONFIG)
</script>

<EmbedChat chatState={embedChatState} />
