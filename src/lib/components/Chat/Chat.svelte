<script lang="ts">
	import { tick } from "svelte"
	import ChatHistoryItem from "./ChatHistoryItem.svelte"
	import ChatInput from "./ChatInput.svelte"
	import type { ChatState } from "./ChatState.svelte"

	type Props = {
		chatState: ChatState
	}

	let { chatState }: Props = $props()

	let showConfig = $state(false)

	let lastChatItem: HTMLDivElement

	$effect(() => {
		const lastChat = chatState.chat.history[chatState.chat.history.length - 1]
		if (lastChat?.type === "chat_response") {
			const lastItem = lastChat.outputs[lastChat.outputs.length - 1]
			if (lastItem?.type === "message.output") {
				const lastContent = lastItem.content[lastItem.content.length - 1]
				if (lastContent?.type === "output_text") {
					lastContent.text
				} else if (lastContent?.type === "output_refusal") {
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
	<button class="LScroll-btn" onclick={() => { lastChatItem.scrollIntoView({ behavior: "smooth" }) }}>LScroll</button>
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
    max-width: 1400px;
    margin: 0 auto;
    height: 100%;
	margin-left: 400px;
	margin-right: 380px;
	max-height: 850px;


  }
	.chat-header {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.chat-config {
		border-bottom: 1px solid #ccc;
	}
	.LScroll-btn {
		width: 60px;
		height: 40px;
		flex-shrink: 0;
		box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2);
		border-radius: 4px;
		border-style: none;
		background: #80A8AF;
		color: white;
		transition: background 0.3s, box-shadow 0.3s;
	}
	.LScroll-btn:hover {
		background: #196370;
		border-style: solid 1px #333;
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
