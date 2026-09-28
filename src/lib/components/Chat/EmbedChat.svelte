<script lang="ts">
	import { tick } from "svelte"
	import { getAccentContrastText } from "$lib/embed/accent-contrast"
	import { ACCENT_HEX_PATTERN } from "$lib/embed/parse-embed-theme"
	import { getModelDisplayName } from "$lib/model-profiles"
	import ChatHistoryItem from "./ChatHistoryItem.svelte"
	import ChatInput from "./ChatInput.svelte"
	import type { ChatState } from "./ChatState.svelte"
	import EmbedFooter from "./EmbedFooter.svelte"
	import EmbedHeader from "./EmbedHeader.svelte"
	import EmbedWelcome from "./EmbedWelcome.svelte"

	// Widget shell for both /embed/agents/[agentId] (authenticated, the one actually iframed into
	// SharePoint - standalone, fills the whole iframe) and /public/embed/agents/[agentId] (anonymous,
	// nested one level down inside EmbedWidgetChrome's own floating-bubble topbar/box). `bare` is the
	// master switch for the latter: it must render pixel-identical to how it did before this component
	// grew a header/welcome/footer/theming, since EmbedWidgetChrome already has its own topbar and its
	// own (unthemed) bubble chrome. showHeader/fillViewport stay separate props so the standalone route
	// can still turn either off independently if ever needed, but `bare` is what EmbedWidgetChrome uses.
	type Props = {
		chatState: ChatState
		showHeader?: boolean
		fillViewport?: boolean
		bare?: boolean
		theme?: "light" | "dark" | "auto"
		accent?: string | undefined
		titleOverride?: string | undefined
		compact?: boolean
	}

	let { chatState, showHeader = true, fillViewport = true, bare = false, theme = "auto", accent = undefined, titleOverride = undefined, compact = false }: Props = $props()

	let container: HTMLDivElement
	let lastChatItem: HTMLDivElement
	let autoScroll = $state(true)
	let previousHistoryLength = 0
	// Set while our own scrollIntoView animation is running, so the scroll events it fires aren't
	// misread as the user scrolling up (which would otherwise stop auto-scroll mid-stream even though
	// the user never touched anything - see the code review that caught this).
	let isProgrammaticScroll = false

	let displayName = $derived(chatState.chat.config.name || getModelDisplayName(chatState.chat.config, chatState.APP_CONFIG) || "Hugin")
	let effectiveTitle = $derived(titleOverride ?? displayName)
	let welcomeMessage = $derived(chatState.chat.config.welcomeMessage?.trim() || `Hei! Jeg er ${displayName}. Hva kan jeg hjelpe deg med?`)
	let suggestedQuestions = $derived((chatState.chat.config.suggestedQuestions ?? []).filter((question) => question.trim().length > 0).slice(0, 4))

	// accent already comes from parseEmbedThemeParams server-side (Task 2), but this is where it
	// gets interpolated into a real style="" attribute - re-checking the pattern here means this
	// component is safe even if it's ever reused with an unvalidated prop from somewhere else.
	// Never applied in bare mode - EmbedWidgetChrome never passes accent, but this also guards
	// against a future caller doing so by mistake and re-theming the unthemed bubble chrome.
	let accentStyle = $derived.by((): string | undefined => {
		if (bare || !accent || !ACCENT_HEX_PATTERN.test(accent)) {
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
		if (isProgrammaticScroll) return
		autoScroll = isNearBottom()
	}

	const prefersReducedMotion = (): boolean => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

	const scrollToBottom = (): void => {
		if (!lastChatItem) return
		isProgrammaticScroll = true
		if (prefersReducedMotion()) {
			lastChatItem.scrollIntoView({ behavior: "auto" })
			isProgrammaticScroll = false
			return
		}
		lastChatItem.scrollIntoView({ behavior: "smooth" })
		// "scrollend" fires once the smooth scroll actually finishes (Chrome/Firefox/Safari 17.4+) -
		// fall back to a timeout comfortably longer than any realistic smooth-scroll duration for
		// older engines, so the guard never gets stuck true if the event never fires.
		if (container && "onscrollend" in container) {
			container.addEventListener(
				"scrollend",
				() => {
					isProgrammaticScroll = false
				},
				{ once: true }
			)
		} else {
			setTimeout(() => {
				isProgrammaticScroll = false
			}, 600)
		}
	}

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
		// promptChat pushes the user's own message AND a queued placeholder response synchronously
		// (ChatState.svelte.ts), so by the time this effect runs, the last item is always the
		// placeholder, never the user's message - checking the last item's type here would make this
		// always false. A length increase, on the other hand, only ever happens when the user sends
		// something (streaming deltas mutate existing items in place), so it's a sufficient signal on
		// its own for "the user just acted, scroll down regardless of where they'd scrolled to".
		const historyGrew = length > previousHistoryLength
		previousHistoryLength = length
		void lastOutputSize // establishes the reactive dependency above; the value itself isn't needed

		if (!autoScroll && !historyGrew) {
			return
		}
		autoScroll = true
		tick().then(scrollToBottom)
	})

	const sendSuggestion = async (question: string): Promise<void> => {
		const emptyFiles = new DataTransfer().files
		await chatState.promptChat(question, emptyFiles)
	}
</script>

<div class="embed-widget" class:bare class:fill-viewport={fillViewport} data-theme={theme} data-compact={compact} style={accentStyle}>
	{#if showHeader}
		<EmbedHeader name={effectiveTitle} avatarUrl={chatState.chat.config.avatarUrl} statusText="Svarer vanligvis på sekunder" onNewChat={chatState.newChat} />
	{/if}
	<div class="chat-items-container" bind:this={container} onscroll={handleScroll} role="log" aria-live="polite" aria-label="Samtale">
		<div class="chat-items">
			{#if !bare && chatState.chat.history.length === 0}
				<EmbedWelcome {welcomeMessage} {suggestedQuestions} onSuggestionClick={sendSuggestion} />
			{/if}
			{#each chatState.chat.history as chatHistoryItem}
				<ChatHistoryItem {chatHistoryItem} />
			{/each}
			<div bind:this={lastChatItem}>&nbsp;</div>
		</div>
	</div>
	<div class="chat-input-container">
		<ChatInput
			{chatState}
			hideAttachment={chatState.chat.config.showAttachmentButton === false}
			hideWebSearch={chatState.chat.config.showWebSearchButton === false}
		/>
	</div>
	{#if !bare}
		<EmbedFooter />
	{/if}
</div>

<style>
	.embed-widget {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Bare mode (nested inside EmbedWidgetChrome's own floating bubble/topbar) must render exactly
	   like the old chrome-less EmbedChat did - no border/shadow/radius, no theme palette, no welcome
	   state, no footer. Everything new lives under :not(.bare) so the bubble is provably unaffected. */
	.embed-widget.bare {
		height: 100%;
		padding-bottom: 1.5rem;
	}

	.embed-widget:not(.bare) {
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
		--embed-user-bubble-padding: 0.5rem 0.75rem;
		--embed-assistant-bubble-bg: #f4f5f6;
		--embed-assistant-bubble-padding: 0.6rem 0.85rem;
		--embed-bubble-radius: 14px;
		--embed-header-height: 4rem;
		--embed-content-max-width: 760px;
		--embed-radius: 16px;
		--embed-accent-fg: #ffffff;
		--embed-typing-dot-color: var(--embed-text);
		--embed-frame-gutter: 0.5rem;
		color-scheme: light;
	}

	/* Standalone usage (/embed/agents/[agentId]) fills the whole iframe, but not flush to its edges -
	   a border/shadow drawn exactly at the iframe boundary has no room to render and is invisible, so
	   this leaves a small gutter all round for the frame to actually show against the host page.
	   `position: fixed` (not a margin) is deliberate: this component is the sole in-flow child of
	   <body> on this route (see +layout.svelte's bare rendering for isEmbedRoute), so a margin here
	   would collapse with body's own margin and inflate the document past the iframe's own viewport
	   height - producing exactly the whole-page scroll/bounce this replaced. `inset` on a fixed
	   element is sized independently of document flow, so it can't do that. */
	.embed-widget.fill-viewport:not(.bare) {
		position: fixed;
		inset: var(--embed-frame-gutter);
		height: auto;
	}
	.embed-widget:not(.fill-viewport):not(.bare) {
		height: 100%;
	}

	/* Dark palette. Also re-tints --color-primary* (used well beyond this file - ChatInput's border/
	   focus ring, style.css's .filled buttons, link colours) since the default light-mode teal has
	   poor contrast against a dark background; an explicit ?accent= still overrides these via the
	   inline style attribute, which always wins the cascade over these class/attribute selectors. */
	.embed-widget[data-theme="dark"] {
		--embed-bg: #17181a;
		--embed-surface: #202225;
		--embed-text: #f2f2f2;
		--embed-muted-text: #a3acae;
		--embed-border: #34383b;
		--embed-user-bubble-bg: #2c3e40;
		--embed-assistant-bubble-bg: #232527;
		--color-primary: #5fb8c9;
		--color-primary-10: color-mix(in srgb, #5fb8c9 12%, #17181a);
		--color-primary-20: color-mix(in srgb, #5fb8c9 22%, #17181a);
		--color-primary-30: color-mix(in srgb, #5fb8c9 32%, #17181a);
		--color-primary-70: color-mix(in srgb, #5fb8c9 70%, white);
		--color-primary-80: color-mix(in srgb, #5fb8c9 85%, white);
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
			--color-primary: #5fb8c9;
			--color-primary-10: color-mix(in srgb, #5fb8c9 12%, #17181a);
			--color-primary-20: color-mix(in srgb, #5fb8c9 22%, #17181a);
			--color-primary-30: color-mix(in srgb, #5fb8c9 32%, #17181a);
			--color-primary-70: color-mix(in srgb, #5fb8c9 70%, white);
			--color-primary-80: color-mix(in srgb, #5fb8c9 85%, white);
			color-scheme: dark;
		}
	}

	.embed-widget[data-compact="true"] {
		--embed-header-height: 3rem;
		--embed-frame-gutter: 0.25rem;
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

	/* style.css's global `a:hover { color: black }` is invisible against a dark embed background. */
	.embed-widget[data-theme="dark"] :global(a:hover) {
		color: var(--color-primary-70);
	}
	@media (prefers-color-scheme: dark) {
		.embed-widget[data-theme="auto"] :global(a:hover) {
			color: var(--color-primary-70);
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
