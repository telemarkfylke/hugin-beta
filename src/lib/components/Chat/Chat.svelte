<script lang="ts">
	import ChatInput from "./ChatInput.svelte"
	import ChatHistoryItem from "./ChatHistoryItem.svelte"
  import type { ChatState } from "./ChatState.svelte";

	type Props = {
		chatState: ChatState
	}

	let { chatState }: Props = $props()
	
</script>

<div class="chat-container">
	<div class="chat-config">
		<h3>{chatState.chat.config.name}</h3>
		{JSON.stringify(chatState.chat.config, null, 2)}
		<br />
		<select bind:value={chatState.chat.config.vendorId}>
			<option value="openai">OpenAI</option>
		</select>
		<br />
		{#if chatState.chat.config.vendorAgent}
			<p>Agent-id: {chatState.chat.config.vendorAgent.id}</p>
		{:else}
			<span>Model:</span>
			<select bind:value={chatState.chat.config.model}>
				<option value="gpt-4o">GPT-4o</option>
				<option value="gpt-4">GPT-4</option>
			</select>
			<br />
			<span>instructions:</span>
			<input type="text" bind:value={chatState.chat.config.instructions} />
			<br />
			<input type="checkbox" bind:checked={chatState.streamResponse} /> Stream
			<br />
		{/if}
	</div>
	<div class="chat-items">
		{#each chatState.chat.history as chatHistoryItem}
			<ChatHistoryItem {chatHistoryItem} />
		{/each}
	</div>

	<ChatInput allowedFileMimeTypes={[]} sendMessage={chatState.promptChat} />
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
