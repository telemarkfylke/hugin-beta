<script lang="ts">
	import ChatInput from "./ChatInput.svelte"
	import ChatHistoryItem from "./ChatHistoryItem.svelte"
  import type { ChatState } from "./ChatState.svelte";
    import { tick } from "svelte";

	type Props = {
		chatState: ChatState
	}

	let { chatState }: Props = $props()

	let showConfig = $state(false)

	let lastChatItem: HTMLDivElement

	$effect(() => {
		const lastChat = chatState.chat.history[chatState.chat.history.length - 1]
		if (lastChat?.type === 'chat_response') {
			const lastItem = lastChat.outputs[lastChat.outputs.length - 1]
			if (lastItem?.type === 'message.output') {
				const lastContent = lastItem.content[lastItem.content.length - 1]
				if (lastContent?.type === 'output_text') {
					lastContent.text
				} else if (lastContent?.type === 'output_refusal') {
					lastContent.reason
				}
			}
		}
		tick().then(() => {
			lastChatItem.scrollIntoView({ behavior: "smooth" })
		})
	})
	
</script>

<div class="chat-container">
	<button onclick={() => { lastChatItem.scrollIntoView({ behavior: "smooth" }) }}>LScroll</button>
	<div class="chat-header">
		<h2>Chat ID: {chatState.chat.config.name}</h2>
		<button onclick={() => showConfig = !showConfig}>
			{#if showConfig} Hide Config {:else} Show Config {/if}
		</button>
	</div>
	{#if showConfig}
		<div class="chat-config">
			{JSON.stringify(chatState.chat.config, null, 2)}
			<br />
			<span>Vendor:</span>
			<select bind:value={chatState.chat.config.vendorId}>
				<option value="openai">OpenAI</option>
				<option value="mistral">Mistral</option>
			</select>
			<br />
			{#if chatState.chat.config.vendorAgent}
				<p>Agent-id: {chatState.chat.config.vendorAgent.id}</p>
			{:else}
				<span>Model:</span>
				<select bind:value={chatState.chat.config.model}>
					{#if chatState.chat.config.vendorId === "openai"}
						<option value="gpt-4o">GPT-4o</option>
						<option value="gpt-4">GPT-4</option>
					{:else if chatState.chat.config.vendorId === "mistral"}
						<option value="mistral-medium-latest">Mistral Medium</option>
						<option value="mistral-large-latest">Mistral Large</option>
					{/if}
				</select>
				<br />
				<span>instructions:</span>
				<input type="text" bind:value={chatState.chat.config.instructions} />
				<br />
				<input type="checkbox" bind:checked={chatState.streamResponse} /> Stream
				<br />
			{/if}
		</div>
	{/if}
	<div class="chat-items">
		{#each chatState.chat.history as chatHistoryItem}
			<ChatHistoryItem {chatHistoryItem} />
		{/each}
		<div bind:this={lastChatItem}>sist</div>
	</div>

	<ChatInput chatConfig={chatState.chat.config} sendMessage={chatState.promptChat} />
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
	.chat-header {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.chat-config {
		border-bottom: 1px solid #ccc;
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
