<script lang="ts">
	import { tick } from "svelte"
	import ChatHistoryItem from "./ChatHistoryItem.svelte"
	import ChatInput from "./ChatInput.svelte"
	import type { ChatState } from "./ChatState.svelte"

	// Chrome-less counterpart to Chat.svelte - same ChatHistoryItem/ChatInput, but without
	// ChatHeaderWithConfig (which drags in the whole config/conversation-list/export UI tree).
	// Used by both /embed/agents/[agentId] (authenticated) and /public/embed/agents/[agentId]
	// (anonymous) - the auth/incognito distinction lives entirely in the ChatState passed in.
	type Props = {
		chatState: ChatState
	}

	let { chatState }: Props = $props()

	let lastChatItem: HTMLDivElement

	$effect(() => {
		chatState.chat.history.length
		tick().then(() => {
			lastChatItem?.scrollIntoView({ behavior: "smooth" })
		})
	})
</script>

<div class="chat-container">
	<div class="chat-items-container" class:empty={chatState.chat.history.length === 0}>
		<div class="chat-items">
			{#each chatState.chat.history as chatHistoryItem}
				<ChatHistoryItem {chatHistoryItem} />
			{/each}
			<div bind:this={lastChatItem}>&nbsp;</div>
		</div>
	</div>
	<div class="chat-input-container">
		<ChatInput {chatState} />
	</div>
</div>

<style>
	.chat-container {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		position: relative;
		flex: 1;
		/* 100% (not 100vh) so this also works nested inside EmbedWidgetChrome's flex layout, below its
		   topbar - the bare full-iframe usage (/embed/agents/[agentId]) still fills the same space
		   either way, since html/body are height:100% and app.html's wrapper is display:contents. */
		height: 100%;
		padding-bottom: 1.5rem;
	}
	.chat-items-container {
		flex: 1;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
	}
	.chat-items {
		max-width: 50rem;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
		padding: 0.3rem 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.chat-input-container {
		max-width: 50rem;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
		padding: 0 0.5rem;
	}
</style>
