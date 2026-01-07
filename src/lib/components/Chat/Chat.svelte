<script lang="ts">
	import type { ChatConfig, ChatInputMessage, ChatResponseObject } from "$lib/types/chat"
  import ChatInput from "./ChatInput.svelte";
    import ChatMessage from "./ChatMessage.svelte";
	import { postChatMessage } from "./PostChatMessage.svelte"
	import type { ChatMessages, ConfigurableChatConfig } from "./types"

	type Props = {
		initialChatConfig: ConfigurableChatConfig
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
	if (!configState.name) {
		configState.name = configState.model || "Chat-agent"
	}
	if (!configState.instructions) {
		configState.instructions = ""
	}
	if (!configState.tools) {
		configState.tools = []
	}
	if (!configState.stream) {
		configState.stream = false
	}
	if (!configState.conversationId) {
		configState.conversationId = ""
	}

	const chatMessages: ChatMessages = $state([])

	const sendMessage = async (inputText: string, _inputFiles: FileList) => {
		// Må finne en måte å håndtere reactivity bedre (den skjønner ikke)
		const userMessage: ChatInputMessage = {
			type: "message",
			role: "user",
			content: [
				{
					type: "input_text",
					text: inputText
				}
			],
			status: "completed"
		}
		
		const chatInput = chatMessages.flatMap(message => {
			if (message.type === "chat_response") {
				return message.outputs.find(output => output.type !== "unknown")
			}
			return message
		}).filter(message => message !== undefined)

		const chatConfig: ChatConfig = {
			...configState,
			inputs: [...chatInput, userMessage]
		}

		chatMessages.push(userMessage)

		const newChatResponseObject: ChatResponseObject = {
			id: `temp_id_${Date.now()}`,
			type: "chat_response",
			vendorId: chatConfig.vendorId,
			createdAt: new Date().toISOString(),
			outputs: [],
			status: "queued",
			usage: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0
			}
		}

		chatMessages.push(newChatResponseObject)
		const reactiveChatResponseObject: ChatResponseObject = chatMessages[chatMessages.length - 1] as ChatResponseObject // The one we just pushed as it is first reactive after adding to state array

		await postChatMessage(chatConfig, reactiveChatResponseObject)
	}
</script>

<div class="chat-container">
	<div class="chat-config">
		<h3>{configState.name || configState.model || 'Chat-agent'}</h3>
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
			<input type="checkbox" bind:checked={configState.stream} /> Stream
			<br />
		{/if}
	</div>
	<div class="chat-items">
		{#each chatMessages as chatMessage}
			<ChatMessage {chatMessage} chatConfigName={configState.name as string} />
		{/each}
	</div>

	<ChatInput allowedFileMimeTypes={[]} {sendMessage} />
</div>

<style>
	.chat-container {
    box-sizing: border-box; /* Include padding and border in total size, to avoid overflow */
    display: flex;
    flex-direction: column;
    max-width: 1280px;
    margin: 0 auto;
    height: 100%;
  }
	.chat-items {
    flex: 1;
    padding: 0.3rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
