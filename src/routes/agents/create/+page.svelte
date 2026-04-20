<script lang="ts">
	import { onMount } from "svelte"
	import ChatComponent from "$lib/components/Chat/Chat.svelte"
	import { ChatState } from "$lib/components/Chat/ChatState.svelte.js"
	import type { FeatureMap } from "$lib/features/featuremap"
	import { getFeatures } from "$lib/features/service"
	import type { Chat } from "$lib/types/chat"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()

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
			project: "DEFAULT",
			vendorId: "MISTRAL",
			model: "mistral-medium-latest",
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

	let featureMap: FeatureMap = $state({})

	onMount(async () => {
		featureMap = await getFeatures()
	})
</script>

<ChatComponent {chatState} {featureMap} />

<!--<button onclick={() => chatState.loadChat('hahah')}>Load chat 'hahah'</button>-->