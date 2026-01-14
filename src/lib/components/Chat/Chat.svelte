<script lang="ts">
	import { tick } from "svelte"
	import ChatConfig from "./ChatConfig.svelte"
	import ChatHistoryItem from "./ChatHistoryItem.svelte"
	import ChatInput from "./ChatInput.svelte"
	import type { ChatState } from "./ChatState.svelte"

	type Props = {
		chatState: ChatState
	}

	let { chatState }: Props = $props()

	let showConfig = $state(false)

	let lastChatItem: HTMLDivElement

	// Scroll-shit
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
	<div class="chat-header">
		<div class="chat-header-left">
			&nbsp;
		</div>
		<div class="chat-header-center">
			<h3>{chatState.chat.config.name || chatState.chat.config.model || "Ukjent navn her"}</h3>
			<button class="icon-button" onclick={() => showConfig = !showConfig} title={showConfig ? "Skjul konfigurasjon" : "Vis konfigurasjon"}>
				<span class="material-symbols-rounded">
					settings
				</span>
			</button>
		</div>
		<div class="chat-header-right">
			<button class="icon-button" onclick={() => chatState.newChat()} title="Ny samtale">
				<span class="material-symbols-rounded">edit_square</span>
			</button>
		</div>
	</div>
	<ChatConfig {chatState} {showConfig} />
	<div class="chat-items" class:empty={chatState.chat.history.length === 0}>
		{#each chatState.chat.history as chatHistoryItem}
			<ChatHistoryItem {chatHistoryItem} />
		{/each}
		<div bind:this={lastChatItem}>&nbsp;</div>
	</div>
	<ChatInput {chatState} sendMessage={chatState.promptChat} />
</div>

<style>
	.chat-container {
    box-sizing: border-box; /* Include padding and border in total size, to avoid overflow */
    display: flex;
    flex-direction: column;
		margin: 0 auto;
		flex: 1;
    max-width: 64rem;
    /* justify-content: center; */ /* Hvis man vil ha de på midten når samtalehistorikken er tom */
    height: 100%;
		padding-bottom: 1.5rem;
  }
	.chat-header {
		height: var(--header-height);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.chat-header-left {
		min-width: 3rem;
		visibility: hidden;
	}
	.chat-header-center {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.chat-items {
		flex: 1;
    padding: 0.3rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
	.chat-items.empty {
		/* display: none; */ /* hvis man vil ha de skjult når tom */
	}
</style>
