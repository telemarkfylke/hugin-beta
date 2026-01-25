<script lang="ts">
	import { page } from "$app/state"
	import ChatComponent from "$lib/components/Chat/Chat.svelte"
	import { ChatState } from "$lib/components/Chat/ChatState.svelte.js"
	import type { Chat } from "$lib/types/chat"
	import type { LayoutProps } from "./$types"

	let { data }: LayoutProps = $props()

	const defaultChat: Chat = {
		_id: "chat-1",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		owner: {
			id: "user-1",
			name: "Test User"
		},
		config: {
			_id: "",
			name: "",
			description: "A default chat configuration",
			project: "DEFAULT",
			vendorId: "MISTRAL",
			model: "mistral-medium-latest",
			instructions: "Answer in Norwegian.",
			conversationId: "",
			type: "private",
			accessGroups: "all",
			created: {
				at: new Date().toISOString(),
				by: {
					id: "system",
					name: "system"
				}
			},
			updated: {
				at: new Date().toISOString(),
				by: {
					id: "system",
					name: "system"
				}
			}
		},
		history: []
	}

	// svelte-ignore state_referenced_locally (don't care, user is user, APP_CONFIG is APP_CONFIG. If somebody messes with them, backend must handle that)
	const chatState = new ChatState(defaultChat, data.authenticatedUser, data.APP_CONFIG)
	chatState.configMode = page.url.searchParams.get("createAgent") === "true"
</script>

<ChatComponent {chatState} />

<!--<button onclick={() => chatState.loadChat('hahah')}>Load chat 'hahah'</button>-->