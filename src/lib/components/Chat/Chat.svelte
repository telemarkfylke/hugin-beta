<script lang="ts">
	import { tick } from "svelte"
	import ChatHeaderWithConfig from "./ChatHeaderWithConfig.svelte"
	import ChatHistoryItem from "./ChatHistoryItem.svelte"
	import ChatInput from "./ChatInput.svelte"
	import type { ChatState } from "./ChatState.svelte"
  import { beforeNavigate } from "$app/navigation";

	type Props = {
		chatState: ChatState
	}

	let { chatState }: Props = $props()

	let lastChatItem: HTMLDivElement

	// Check if edited and routing
	beforeNavigate(({ cancel, from, to }) => {
		if (chatState.configEdited && from?.url.pathname !== to?.url.pathname) {
			const confirmLeave = confirm("Du har ulagrede endringer i agent-konfigurasjonen. Er du sikker på at du vil forlate siden?");
			if (!confirmLeave) {
				cancel();
			}
		}
	});

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
	<div class="chat-items" class:mobile-hidden={chatState.configMode}  class:empty={chatState.chat.history.length === 0}>
		{#each chatState.chat.history as chatHistoryItem}
			<ChatHistoryItem {chatHistoryItem} />
		{/each}
		<div bind:this={lastChatItem}>&nbsp;</div>
	</div>
	<div class="chat-input-container" class:mobile-hidden={chatState.configMode}>
		<ChatInput {chatState} sendMessage={chatState.promptChat} />
	</div>
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
		padding: 0rem 0.5rem 1.5rem 0.5rem;
  }
	.chat-items {
		flex: 1;
		max-height: 100%;
    padding: 0.3rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
	.chat-items.empty {
		/* display: none; */ /* hvis man vil ha de skjult når tom */
	}
	.mobile-hidden {
		display: none;
	}
	@media screen and (min-height: 60rem) and (min-width: 40rem) {
		.chat-items.mobile-hidden {
			display: flex;
		}
		.chat-input-container.mobile-hidden {
			display: block;
		}
	}
</style>
