<script lang="ts">
	import { onMount } from "svelte"
	import type { ChatState } from "./ChatState.svelte"
	import EmbedChat from "./EmbedChat.svelte"

	// Floating widget chrome for the anonymous /public/embed/**: adds an open/closed bubble on top
	// of the plain EmbedChat body, and drives the hosting page's iframe size via postMessage - the
	// counterpart to static/widget.js's "setChatbotFrameSize" listener (same protocol/message shape
	// as bothotell-svelte-web's BotWrapper.svelte, ported here rather than shared across repos).
	// NOT used by the authenticated /embed/agents/[agentId] - that one is a plain, host-page-sized
	// iframe meant to sit inline on an internal page, not a floating corner bubble.
	type Props = {
		chatState: ChatState
	}
	let { chatState }: Props = $props()

	let isOpen = $state(true)

	type FrameSize = { width: number | string; height: number | string; position: "fullscreen" | "corner" }

	// Best-effort mobile detection, ported from bothotell-svelte-web's BotWrapper: touch/hover media
	// queries first (catches wide touch-primary phones that a screen-width check would miss),
	// user-agent keywords as a fallback for browsers that misreport touch/pointer capabilities.
	const isMobileDevice = (): boolean => {
		if (typeof navigator === "undefined") return false
		const userAgent = navigator.userAgent.toLowerCase()
		if (userAgent.includes("windows nt")) return false // Desktop Windows is never "mobile" here, even on touch-screen laptops
		const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(any-pointer: coarse)").matches
		const hasNoHover = window.matchMedia("(hover: none)").matches
		if (hasCoarsePointer && hasNoHover) return true
		if ("ontouchstart" in window && "orientation" in window) return true
		const mobileKeywords = ["android", "webos", "iphone", "ipad", "ipod", "blackberry", "iemobile", "opera mini", "mobile"]
		return mobileKeywords.some((keyword) => userAgent.includes(keyword))
	}

	// Mobile: full-screen overlay (better UX than a tiny corner box on a small screen).
	// Desktop: fixed-size box, sized by the parent's widget.js into its bottom-right corner.
	const getFrameSize = (state: "open" | "closed"): FrameSize => {
		if (isMobileDevice()) {
			return state === "open" ? { width: "100vw", height: "100dvh", position: "fullscreen" } : { width: 60, height: 60, position: "corner" }
		}
		return state === "open" ? { width: 350, height: 500, position: "corner" } : { width: 80, height: 80, position: "corner" }
	}

	const postFrameSize = (state: "open" | "closed"): void => {
		if (typeof window === "undefined" || window.parent === window) return // Not actually inside an iframe (e.g. visited directly) - nothing to size
		window.parent.postMessage({ type: "setChatbotFrameSize", ...getFrameSize(state) }, "*")
	}

	const toggleWidget = (): void => {
		isOpen = !isOpen
		postFrameSize(isOpen ? "open" : "closed")
	}

	onMount(() => {
		if (isMobileDevice()) isOpen = false // Always start collapsed on mobile, regardless of the desktop default above
		postFrameSize(isOpen ? "open" : "closed")

		// Keep the input field visible above the on-screen keyboard on mobile (same approach as
		// bothotell-svelte-web): shrink the frame to the visual viewport while the keyboard is up.
		const viewport = window.visualViewport
		if (!viewport) return
		const handleViewportResize = (): void => {
			if (!isOpen || !isMobileDevice()) return
			const keyboardHeight = window.innerHeight - viewport.height
			if (keyboardHeight > 100) {
				window.parent.postMessage({ type: "setChatbotFrameSize", width: viewport.width, height: viewport.height, position: "fullscreen" }, "*")
			} else {
				postFrameSize("open")
			}
		}
		viewport.addEventListener("resize", handleViewportResize)
		return () => viewport.removeEventListener("resize", handleViewportResize)
	})
</script>

{#if isOpen}
	<div class="widget-wrapper">
		<div class="widget-topbar">
			<span class="material-symbols-outlined widget-topbar-icon">chat</span>
			<span class="widget-topbar-title">{chatState.chat.config.name || chatState.chat.config.model || "Chat"}</span>
			<button class="icon-button widget-minimize" onclick={toggleWidget} title="Minimer" aria-label="Minimer chat">
				<span class="material-symbols-outlined">close</span>
			</button>
		</div>
		<div class="widget-body">
			<EmbedChat {chatState} />
		</div>
	</div>
{:else}
	<button class="widget-bubble" onclick={toggleWidget} title="Åpne chat" aria-label="Åpne chat">
		<span class="material-symbols-outlined">chat</span>
	</button>
{/if}

<style>
	.widget-wrapper {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		height: 100%;
		border: 1px solid var(--color-primary-30);
		border-radius: 12px;
		overflow: hidden;
		background: white;
	}

	.widget-topbar {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background-color: var(--color-primary-10);
		border-bottom: 1px solid var(--color-primary-30);
		flex-shrink: 0;
	}

	.widget-topbar-icon {
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.widget-topbar-title {
		flex: 1;
		min-width: 0;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.widget-minimize {
		flex-shrink: 0;
	}

	.widget-body {
		flex: 1;
		min-height: 0;
	}

	.widget-bubble {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 50%;
		background-color: var(--color-primary);
		color: white;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
	}

	.widget-bubble:hover {
		opacity: 0.9;
	}

	.widget-bubble .material-symbols-outlined {
		font-size: 2rem;
	}
</style>
