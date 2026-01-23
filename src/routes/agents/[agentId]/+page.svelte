<script lang="ts">
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

	// Get url param agentId and update chat config when it changes
	$effect(() => {
		page.params.agentId
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
		agentChatState.changeChat(initialChat)
	})
</script>
  <ChatComponent chatState={agentChatState} showConfig={page.url.searchParams.get("editAgent") === "true"} />
<style>
  
</style>