<script lang="ts">
	import ChatComponent from "$lib/components/Chat/Chat.svelte"
	import { ChatState } from "$lib/components/Chat/ChatState.svelte.js"
	import type { Chat } from "$lib/types/chat"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()

	// Defaultchatten
	const defaultChat: Chat = {
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

	// svelte-ignore state_referenced_locally (don't care, user is user, APP_CONFIG is APP_CONFIG. If somebody messes with them, backend must handle that)
	const chatState = new ChatState(defaultChat, data.authenticatedUser, data.APP_CONFIG)
</script>

<ChatComponent {chatState} />

<!--<button onclick={() => chatState.loadChat('hahah')}>Load chat 'hahah'</button>-->