<script lang="ts">
	import { tick } from "svelte"
	import { ACCENT_HEX_PATTERN } from "$lib/embed/parse-embed-theme"
	import { getAccentContrastText } from "$lib/embed/accent-contrast"
	import { getModelDisplayName } from "$lib/model-profiles"
	import ChatHistoryItem from "./ChatHistoryItem.svelte"
	import ChatInput from "./ChatInput.svelte"
	import EmbedFooter from "./EmbedFooter.svelte"
	import EmbedHeader from "./EmbedHeader.svelte"
	import EmbedWelcome from "./EmbedWelcome.svelte"
	import type { ChatState } from "./ChatState.svelte"

	// Widget shell for both /embed/agents/[agentId] (authenticated, the one actually iframed into
	// SharePoint - standalone, fills the whole iframe) and /public/embed/agents/[agentId] (anonymous,
	// nested one level down inside EmbedWidgetChrome's own floating-bubble topbar/box). showHeader and
	// fillViewport default to the standalone case; EmbedWidgetChrome passes both as false so it keeps
	// rendering exactly as it did before this component grew a header/footer.
	type Props = {
		chatState: ChatState
		showHeader?: boolean
		fillViewport?: boolean
		theme?: "light" | "dark" | "auto"
		accent?: string | undefined
		titleOverride?: string | undefined
		compact?: boolean
	}

	let { chatState, showHeader = true, fillViewport = true, theme = "auto", accent = undefined, titleOverride = undefined, compact = false }: Props = $props()

	let container: HTMLDivElement
	let lastChatItem: HTMLDivElement
	let autoScroll = $state(true)
	let previousHistoryLength = 0

	let displayName = $derived(chatState.chat.config.name || getModelDisplayName(chatState.chat.config, chatState.APP_CONFIG) || "Hugin")
	let effectiveTitle = $derived(titleOverride ?? displayName)
	let welcomeMessage = $derived(chatState.chat.config.welcomeMessage?.trim() || `Hei! Jeg er ${displayName}. Hva kan jeg hjelpe deg med?`)
	let suggestedQuestions = $derived((chatState.chat.config.suggestedQuestions ?? []).filter((question) => question.trim().length > 0).slice(0, 4))

	// accent already comes from parseEmbedThemeParams server-side (Task 2), but this is where it
	// gets interpolated into a real style="" attribute - re-checking the pattern here means this
	// component is safe even if it's ever reused with an unvalidated prop from somewhere else.
	let accentStyle = $derived.by((): string | undefined => {
		if (!accent || !ACCENT_HEX_PATTERN.test(accent)) {
			return undefined
		}
		const fg = getAccentContrastText(accent)
		return (
			`--color-primary:#${accent};` +
			`--color-primary-10:color-mix(in srgb, #${accent} 10%, white);` +
			`--color-primary-20:color-mix(in srgb, #${accent} 20%, white);` +
			`--color-primary-30:color-mix(in srgb, #${accent} 30%, white);` +
			`--color-primary-70:color-mix(in srgb, #${accent} 70%, black);` +
			`--color-primary-80:color-mix(in srgb, #${accent} 80%, black);` +
			`--embed-accent-fg:${fg};`
		)
	})

	const isNearBottom = (): boolean => {
		if (!container) return true
		return container.scrollHeight - container.scrollTop - container.clientHeight < 80
	}

	const handleScroll = (): void => {
		autoScroll = isNearBottom()
	}

	const prefersReducedMotion = (): boolean => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

	$effect(() => {
		const length = chatState.chat.history.length
		const last = chatState.chat.history[length - 1]
		// Reading the streamed text length (not just history.length) makes this effect re-run on
		// every delta too, not just when a whole new turn is pushed - otherwise a long streaming
		// reply would never pull the view along, even for a user who hasn't scrolled up at all.
		const lastOutputSize =
			last?.type === "chat_response"
				? last.outputs.reduce((total, outputMessage) => total + outputMessage.content.reduce((innerTotal, part) => innerTotal + (part.type === "output_text" ? part.text.length : 0), 0), 0)
				: 0
		const isNewUserMessage = length > previousHistoryLength && last?.type === "message.input"
		previousHistoryLength = length
		void lastOutputSize // establishes the reactive dependency above; the value itself isn't needed

		if (!autoScroll && !isNewUserMessage) {
			return
		}
		autoScroll = true
		tick().then(() => {
			lastChatItem?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" })
		})
	})

	const sendSuggestion = async (question: string): Promise<void> => {
		const emptyFiles = new DataTransfer().files
		await chatState.promptChat(question, emptyFiles)
	}
</script>

<div class="embed-widget" class:fill-viewport={fillViewport} data-theme={theme} data-compact={compact} style={accentStyle}>
	{#if showHeader}
		<EmbedHeader name={effectiveTitle} avatarUrl={chatState.chat.config.avatarUrl} statusText="Svarer vanligvis på sekunder" onNewChat={chatState.newChat} />
	{/if}
	<div class="chat-items-container" bind:this={container} onscroll={handleScroll} role="log" aria-live="polite" aria-label="Samtale">
		<div class="chat-items">
			{#if chatState.chat.history.length === 0}
				<EmbedWelcome {welcomeMessage} {suggestedQuestions} onSuggestionClick={sendSuggestion} />
			{/if}
			{#each chatState.chat.history as chatHistoryItem}
				<ChatHistoryItem {chatHistoryItem} />
			{/each}
			<div bind:this={lastChatItem}>&nbsp;</div>
		</div>
	</div>
	<div class="chat-input-container">
		<ChatInput {chatState} />
	</div>
	<EmbedFooter />
</div>

<style>
	.embed-widget {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--embed-bg);
		color: var(--embed-text);
		border: 1px solid var(--embed-border);
		border-radius: var(--embed-radius);
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.08),
			0 8px 24px rgba(0, 0, 0, 0.06);

		--embed-bg: #ffffff;
		--embed-surface: #ffffff;
		--embed-text: #1a1a1a;
		--embed-muted-text: #5f6b6d;
		--embed-border: var(--color-primary-30, #d8d8d8);
		--embed-user-bubble-bg: var(--color-primary-10, #eef2f2);
		--embed-assistant-bubble-bg: #f4f5f6;
		--embed-assistant-bubble-padding: 0.6rem 0.85rem;
		--embed-bubble-radius: 14px;
		--embed-header-height: 4rem;
		--embed-content-max-width: 760px;
		--embed-radius: 16px;
		--embed-accent-fg: #ffffff;
		--embed-typing-dot-color: var(--embed-text);
		color-scheme: light;
	}

	/* Standalone usage (/embed/agents/[agentId]) fills the whole iframe. Nested usage (inside
	   EmbedWidgetChrome's own fixed-size floating box) must stay height:100% - the ancestor there
	   is already sized to a small corner box, not the full viewport. */
	.embed-widget.fill-viewport {
		height: 100dvh;
	}
	.embed-widget:not(.fill-viewport) {
		height: 100%;
	}

	.embed-widget[data-theme="dark"] {
		--embed-bg: #17181a;
		--embed-surface: #202225;
		--embed-text: #f2f2f2;
		--embed-muted-text: #a3acae;
		--embed-border: #34383b;
		--embed-user-bubble-bg: #2c3e40;
		--embed-assistant-bubble-bg: #232527;
		color-scheme: dark;
	}

	@media (prefers-color-scheme: dark) {
		.embed-widget[data-theme="auto"] {
			--embed-bg: #17181a;
			--embed-surface: #202225;
			--embed-text: #f2f2f2;
			--embed-muted-text: #a3acae;
			--embed-border: #34383b;
			--embed-user-bubble-bg: #2c3e40;
			--embed-assistant-bubble-bg: #232527;
			color-scheme: dark;
		}
	}

	.embed-widget[data-compact="true"] {
		--embed-header-height: 3rem;
	}

	.chat-items-container {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--embed-border) transparent;
	}

	.chat-items {
		max-width: var(--embed-content-max-width);
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.embed-widget[data-compact="true"] .chat-items {
		padding: 0.5rem;
		gap: 0.35rem;
	}

	.chat-input-container {
		max-width: var(--embed-content-max-width);
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
		padding: 0.5rem 0.75rem 0;
		flex-shrink: 0;
	}

	/* highlight.js's a11y-light theme (imported globally by markdown-formatter.ts) is light-only -
	   override it inside a dark embed so code blocks don't render dark text on a light background. */
	.embed-widget[data-theme="dark"] :global(pre code.hljs) {
		background: #1e1e1e;
		color: #e6e6e6;
	}
	@media (prefers-color-scheme: dark) {
		.embed-widget[data-theme="auto"] :global(pre code.hljs) {
			background: #1e1e1e;
			color: #e6e6e6;
		}
	}

	.embed-widget :global(button:focus-visible),
	.embed-widget :global(a:focus-visible),
	.embed-widget :global(textarea:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.embed-widget :global(*) {
			scroll-behavior: auto !important;
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
