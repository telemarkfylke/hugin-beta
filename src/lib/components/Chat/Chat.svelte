<script lang="ts">
  import type { ChatItems, ConfigurableChatConfig } from "./types";
  import type { ChatConfig, ChatInputMessage } from "$lib/types/chat";
  import { postChatMessage } from "./PostChatMessage.svelte";

	type Props = {
		initialChatConfig: ConfigurableChatConfig,
	}

	let { initialChatConfig }: Props = $props()

	// svelte-ignore state_referenced_locally (thats what i want)
	if (!initialChatConfig.model && !initialChatConfig.vendorAgent) {
		throw new Error("Either model or vendorAgent must be set in initialChatConfig")
	}

	// svelte-ignore state_referenced_locally (thats what i want)
	if (initialChatConfig.vendorAgent && !initialChatConfig.vendorAgent.id) {
		throw new Error("vendorAgent must have a valid id in initialChatConfig")
	}

	// svelte-ignore state_referenced_locally (thats what i want)
	const configState: ConfigurableChatConfig = $state(initialChatConfig)

	// Populate some config fields if not set to make them configurable
	if (!configState.instructions) {
		configState.instructions = ''
	}
	if (!configState.tools) {
		configState.tools = []
	}
	if (!configState.stream) {
		configState.stream = false
	}
	if (!configState.conversationId) {
		configState.conversationId = ''
	}

	const chatItems: ChatItems = $state({})

	let chatInputText = $state('')

	const sendMessage = async () => {
		const userMessage: ChatInputMessage = {
			type: 'message',
			role: 'user',
			content: [
				{ 
					type: 'input_text',
					text: chatInputText
				}
			],
			status: 'completed'
		}
		const chatConfig: ChatConfig = {
			...configState,
			inputs: [...Object.values(chatItems), userMessage]
		}
		chatItems[`input_${Date.now()}`] = userMessage
		chatInputText = ''

		console.log("Sending chat with config:", chatConfig)
		await postChatMessage(chatConfig, chatItems)
		console.log("Chat items after response:", chatItems)
	}
</script>

<div>
	{JSON.stringify(configState, null, 2)}
	
	<br />
	<select bind:value={configState.vendorId}>
		<option value="openai">OpenAI</option>
	</select>
	<br />
	{#if configState.vendorAgent}
		<p>Agent-id: {configState.vendorAgent.id}</p>
	{:else}
		<span>Model:</span>
		<select bind:value={configState.model}>
			<option value="gpt-4o">GPT-4o</option>
			<option value="gpt-4">GPT-4</option>
		</select>
		<br />
		<span>instructions:</span>
		<input type="text" bind:value={configState.instructions} />
		<br />
		<span>streaming</span>
		<input type="checkbox" bind:checked={configState.stream} /> Stream
		<br />
	{/if}

	<input type="text" bind:value={chatInputText} placeholder="Type your message..." />
	<button onclick={sendMessage}>Send</button>
	<div>
		{#each Object.values(chatItems) as chatItem}
			<div>
				<strong>{chatItem.type}:</strong> {JSON.stringify(chatItem)}
			</div>
		{/each}
	</div>
</div>
