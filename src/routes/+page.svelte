<script lang="ts">
	import ChatComponent from "$lib/components/Chat/Chat.svelte"
	import { ChatState } from "$lib/components/Chat/ChatState.svelte.js"
	import type { Chat } from "$lib/types/chat"

	const defaultChat: Chat = {
		id: "chat-1",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		owner: {
			id: "user-1",
			name: "Test User"
		},
		config: {
			id: "config-1",
			name: "Mistralos",
			description: "A default chat configuration",
			vendorId: "mistral",
			model: "mistral-medium-latest",
			instructions: "Answer in Norwegian."
		},
		history: []
	}

	const chatState = new ChatState(defaultChat)
</script>

<ChatComponent {chatState} />

<!--<button onclick={() => chatState.loadChat('hahah')}>Load chat 'hahah'</button>-->