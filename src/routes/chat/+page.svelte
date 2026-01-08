<script lang="ts">
  import ChatComponent from "$lib/components/Chat/Chat.svelte";
  import { ChatState } from "$lib/components/Chat/ChatState.svelte";
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
			name: "Default Chat",
			description: "A default chat configuration",
			vendorId: "openai",
			model: "gpt-4o",
			instructions: "Answer in Norwegian.",
		},
		history: []
	}

	const chatState = new ChatState(defaultChat);

</script>

<ChatComponent {chatState} />