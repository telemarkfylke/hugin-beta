<script lang="ts">
	import ChatComponent from "$lib/components/Chat/Chat.svelte"
	import { ChatState } from "$lib/components/Chat/ChatState.svelte.js"
	import { defaultProfileSelection } from "$lib/model-profiles"
	import type { Chat } from "$lib/types/chat"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()

	// svelte-ignore state_referenced_locally (APP_CONFIG never changes during the page's lifetime)
	const defaultSelection = defaultProfileSelection(data.APP_CONFIG, "ASSISTANT")
	if (!defaultSelection) {
		throw new Error("No model profile available - check models.config.ts and vendor API keys")
	}

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
			description: "",
			...defaultSelection,
			instructions: "Answer in Norwegian.",
			conversationId: "",
			type: "private",
			accessGroups: ["all"],
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
	chatState.configMode = true
</script>

<ChatComponent {chatState} />

<!--<button onclick={() => chatState.loadChat('hahah')}>Load chat 'hahah'</button>-->