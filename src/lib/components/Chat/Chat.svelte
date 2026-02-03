<script lang="ts">
	import { tick } from "svelte"
	import { beforeNavigate } from "$app/navigation"
	import ChatHeaderWithConfig from "./ChatHeaderWithConfig.svelte"
	import ChatHistoryItem from "./ChatHistoryItem.svelte"
	import ChatInput from "./ChatInput.svelte"
	import type { ChatState } from "./ChatState.svelte"

	type Props = {
		chatState: ChatState
	}

	let { chatState }: Props = $props()

	let lastChatItem: HTMLDivElement

	// Check if edited and routing
	beforeNavigate(({ cancel, from, to, type }) => {
		// goto is for programmatic navigation (for now at least), we only care about user navigation
		if (type !== "goto" && chatState.configEdited && from?.url.pathname !== to?.url.pathname) {
			const confirmLeave = confirm("Du har ulagrede endringer i agent-konfigurasjonen. Er du sikker på at du vil forlate siden?")
			if (!confirmLeave) {
				cancel()
			}
		}
	})

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
	<ChatHeaderWithConfig {chatState} />
	<div class="chat-items-container" class:mobile-hidden={chatState.configMode}  class:empty={chatState.chat.history.length === 0}>
		<div class="chat-items">
			{#each chatState.chat.history as chatHistoryItem}
				<ChatHistoryItem {chatHistoryItem} />
			{/each}
			<div bind:this={lastChatItem}>&nbsp;</div>
		</div>
	</div>
	<div class="chat-input-container" class:mobile-hidden={chatState.configMode}>
		<ChatInput {chatState} sendMessage={chatState.promptChat} />
	</div>
</div>

<style>
	.chat-container {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
		position: relative;
		flex: 1;
    height: 100vh;
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
	.chat-items.empty {
		/* display: none; */ /* hvis man vil ha de skjult når tom */
	}
	.chat-input-container {
		max-width: 50rem;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
		padding: 0 0.5rem;
	}

	.mobile-hidden {
		display: none;
	}

	@media screen and (min-height: 60rem) and (min-width: 40rem) {
		.chat-items-container.mobile-hidden {
			display: flex;
		}
		.chat-input-container.mobile-hidden {
			display: block;
		}
	}
</style>
