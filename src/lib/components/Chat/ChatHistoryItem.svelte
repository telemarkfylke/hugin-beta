<script lang="ts">
	import favicon16 from "$lib/assets/favicon-16x16.png"
	import type { ChatHistoryItem } from "$lib/types/chat"
	import TypingDots from "../TypingDots.svelte"
	import ChatItem from "./ChatItems/MessageItem.svelte"

	type Props = {
		chatHistoryItem: ChatHistoryItem
	}
	let { chatHistoryItem }: Props = $props()
</script>

{#if chatHistoryItem.type === "message.input"}
	<ChatItem chatItem={chatHistoryItem} />
{/if}
{#if chatHistoryItem.type === "chat_response"}
	<div class="chat-response">
		<h5 class="chat-response-header">
			<img src={favicon16} alt="favicon" />
			{chatHistoryItem.config.name}
		</h5>
		{#if chatHistoryItem.status === "queued" || (chatHistoryItem.status === "in_progress" && chatHistoryItem.outputs.length === 0)}
			<TypingDots />
		{:else}
			{#each chatHistoryItem.outputs as chatItem}
				<ChatItem {chatItem} />
			{/each}
		{/if}
	</div>
{/if}

<style>
	.chat-response-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-md);
		margin-bottom: var(--spacing-sm);
		color: var(--color-text-primary);
		font-weight: 600;
		font-size: var(--font-size-sm);
	}

	.chat-response-header img {
		width: 1.25rem;
		height: 1.25rem;
	}
</style>
