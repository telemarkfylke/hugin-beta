<script lang="ts">
	import { tick } from "svelte"
	import { beforeNavigate } from "$app/navigation"
	import favicon16 from "$lib/assets/favicon-16x16.png"
	import { markdownFormatter } from "$lib/formatting/markdown-formatter.js"
	import TypingDots from "../TypingDots.svelte"
	import ChatHeaderWithConfig from "./ChatHeaderWithConfig.svelte"
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
			const confirmLeave = confirm("Du har ulagrede endringer i assistent-konfigurasjonen. Er du sikker på at du vil forlate siden?")
			if (!confirmLeave) {
				cancel()
			}
		}
	})

	// Track the last text part of the last message to trigger scroll on streaming updates
	$effect(() => {
		const messages = chatState.aiChat.messages
		const lastMsg = messages[messages.length - 1]
		if (lastMsg) {
			const lastPart = lastMsg.parts[lastMsg.parts.length - 1]
			if (lastPart?.type === "text") {
				lastPart.text // read to track changes
			}
		}
		tick().then(() => {
			lastChatItem.scrollIntoView({ behavior: "smooth" })
		})
	})

	const isImageType = (mediaType: string) => mediaType.startsWith("image/")
</script>

<div class="chat-container">
	<ChatHeaderWithConfig bind:chatState={chatState} />
	<div class="chat-items-container" class:mobile-hidden={chatState.configMode} class:empty={chatState.aiChat.messages.length === 0}>
		<div class="chat-items">
			{#each chatState.aiChat.messages as message (message.id)}
				{#if message.role === "user"}
					<div class="user-message">
						{#each message.parts as part}
							{#if part.type === "text"}
								<div class="user-message-part-text">{part.text}</div>
							{:else if part.type === "file"}
								{#if isImageType(part.mediaType)}
									<img src={part.url} alt="Opplastet bilde" style="max-width: 100px; max-height: 100px;" />
								{:else}
									<div class="user-message-part-file">
										<span class="material-symbols-outlined">description</span>
										{"filename" in part ? part.filename : part.mediaType}
									</div>
								{/if}
							{/if}
						{/each}
					</div>
				{:else if message.role === "assistant"}
					<div class="chat-response">
						<h5 class="chat-response-header">
							<img src={favicon16} alt="favicon" />
							{chatState.chatConfig.name || "Assistent"}
						</h5>
						{#if chatState.aiChat.status === "submitted" && message === chatState.aiChat.messages[chatState.aiChat.messages.length - 1] && message.parts.filter(p => p.type === "text").every(p => p.type === "text" && p.text === "")}
							<TypingDots />
						{:else}
							{#each message.parts as part}
								{#if part.type === "text" && part.text.length > 0}
									<div class="assistant-message-content-part">
										{@html markdownFormatter(part.text)}
									</div>
								{:else if part.type === "source-url"}
									<!-- source-url parts are collected and rendered below as citations -->
								{/if}
							{/each}
							{@const sourceParts = message.parts.filter(p => p.type === "source-url")}
							{#if sourceParts.length > 0}
								<div class="citations">
									<strong>Kilder:</strong>
									<ol>
										{#each sourceParts as src}
											{#if src.type === "source-url"}
												<li><a href={src.url} target="_blank" rel="noopener noreferrer">{src.title ?? src.url}</a></li>
											{/if}
										{/each}
									</ol>
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			{/each}
			{#if chatState.aiChat.status === "submitted" && chatState.aiChat.messages[chatState.aiChat.messages.length - 1]?.role !== "assistant"}
				<div class="chat-response">
					<h5 class="chat-response-header">
						<img src={favicon16} alt="favicon" />
						{chatState.chatConfig.name || "Assistent"}
					</h5>
					<TypingDots />
				</div>
			{/if}
			{#if chatState.aiChat.status === "error" && chatState.aiChat.error}
				<div class="chat-error">
					<span class="material-symbols-outlined">error</span>
					{chatState.aiChat.error.message}
				</div>
			{/if}
			<div bind:this={lastChatItem}>&nbsp;</div>
		</div>
	</div>
	<div class="chat-input-container" class:mobile-hidden={chatState.configMode}>
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
		min-height: 0;
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

	/* User messages */
	.user-message {
		align-self: flex-end;
		background-color: #daf1da;
		padding: 0.5rem;
		border-radius: 8px;
		max-width: 20rem;
		overflow-wrap: break-word;
	}
	.user-message-part-file {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.85rem;
	}

	/* Assistant messages */
	.chat-response {
		display: flex;
		flex-direction: column;
	}
	.chat-response-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
	}
	.assistant-message-content-part {
		overflow-wrap: break-word;
	}

	/* Citations */
	.citations {
		margin-top: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px solid #e0e0e0;
		font-size: 0.85rem;
	}
	.citations ol {
		margin: 0.25rem 0 0 0;
		padding-left: 1.25rem;
	}
	.citations li {
		margin-bottom: 0.2rem;
	}
	.citations a {
		color: #1a73e8;
		text-decoration: none;
	}
	.citations a:hover {
		text-decoration: underline;
	}

	/* Error display */
	.chat-error {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background-color: #fdecea;
		border-left: 3px solid #d32f2f;
		border-radius: 4px;
		color: #d32f2f;
		font-size: 0.9rem;
	}
</style>
