<script lang="ts">
	import { fade } from "svelte/transition"
	import { dismissSpotlightPermanently, isSpotlightDismissed } from "$lib/util/spotlight-util"

	type FixedPlacement = "center" | "top-right" | "bottom-right" | "bottom-left" | "top-left"
	type AnchorSide = "top" | "bottom" | "left" | "right"
	type Coords = { top: number; left: number; transform: string }

	type Props = {
		id: string
		icon?: string
		header: string
		text: string
		subtext?: string
		active?: boolean
		placement?: FixedPlacement
		anchor?: HTMLElement | null
		anchorSide?: AnchorSide
		anchorOffset?: number
		onDismiss?: () => void
	}

	let {
		id,
		icon,
		header,
		text,
		subtext,
		active = true,
		placement = "bottom-right",
		anchor = null,
		anchorSide = "bottom",
		anchorOffset = 10,
		onDismiss
	}: Props = $props()

	let dismissedPermanently = $state(false)
	let closedThisSession = $state(false)
	let dontShowAgain = $state(false)
	let coords: Coords | null = $state(null)

	$effect(() => {
		dismissedPermanently = isSpotlightDismissed(id)
	})

	let visible = $derived(active && !dismissedPermanently && !closedThisSession)

	$effect(() => {
		if (!visible || !anchor) {
			coords = null
			return
		}

		const update = () => {
			if (!anchor) return
			const rect = anchor.getBoundingClientRect()
			let top = rect.top
			let left = rect.left
			let transform = ""
			if (anchorSide === "bottom") {
				top = rect.bottom + anchorOffset
			} else if (anchorSide === "top") {
				top = rect.top - anchorOffset
				transform = "translateY(-100%)"
			} else if (anchorSide === "right") {
				left = rect.right + anchorOffset
			} else if (anchorSide === "left") {
				left = rect.left - anchorOffset
				transform = "translateX(-100%)"
			}
			coords = {
				top: Math.min(Math.max(top, 8), window.innerHeight - 8),
				left: Math.min(Math.max(left, 8), window.innerWidth - 8),
				transform
			}
		}

		update()
		window.addEventListener("resize", update)
		window.addEventListener("scroll", update, true)
		return () => {
			window.removeEventListener("resize", update)
			window.removeEventListener("scroll", update, true)
		}
	})

	const close = () => {
		if (dontShowAgain) dismissSpotlightPermanently(id)
		closedThisSession = true
		onDismiss?.()
	}
</script>

{#if visible && (!anchor || coords)}
	<div
		class="spotlight"
		class:anchored={!!anchor}
		class:center={!anchor && placement === "center"}
		class:top-right={!anchor && placement === "top-right"}
		class:bottom-right={!anchor && placement === "bottom-right"}
		class:bottom-left={!anchor && placement === "bottom-left"}
		class:top-left={!anchor && placement === "top-left"}
		style:top={coords ? `${coords.top}px` : undefined}
		style:left={coords ? `${coords.left}px` : undefined}
		style:transform={coords?.transform || undefined}
		transition:fade={{ duration: 150 }}
	>
		<button class="icon-button close-button" onclick={close} title="Lukk">
			<span class="material-symbols-outlined">close</span>
		</button>
		<div class="spotlight-header">
			{#if icon}
				<div class="spotlight-icon">
					<span class="material-symbols-rounded">{icon}</span>
				</div>
			{/if}
			<div class="spotlight-text">
				<h4>{header}</h4>
				<p>{text}</p>
				{#if subtext}<p class="spotlight-subtext">{subtext}</p>{/if}
			</div>
		</div>
		<label class="checkbox-label">
			<input type="checkbox" bind:checked={dontShowAgain} />
			Ikke vis denne igjen
		</label>
	</div>
{/if}

<style>
	.spotlight {
		position: fixed;
		z-index: 150;
		background: white;
		border-radius: 10px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
		padding: 1rem;
		width: 20rem;
		max-width: calc(100vw - 2rem);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.spotlight.top-right {
		top: 1rem;
		right: 1rem;
	}
	.spotlight.bottom-right {
		bottom: 1rem;
		right: 1rem;
	}
	.spotlight.bottom-left {
		bottom: 1rem;
		left: 1rem;
	}
	.spotlight.top-left {
		top: 1rem;
		left: 1rem;
	}
	.spotlight.center {
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.spotlight-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding-right: 1.5rem;
	}

	.spotlight-icon {
		width: 2.5rem;
		height: 2.5rem;
		min-width: 2.5rem;
		border-radius: 50%;
		background-color: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spotlight-icon span {
		font-size: 1.4rem;
		color: white;
	}

	.spotlight-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
	}

	.spotlight-text h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.spotlight-text p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.spotlight-subtext {
		font-size: 0.8rem !important;
		color: #666;
	}

	.close-button {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		justify-content: center;
	}

	.close-button span {
		font-size: 1.1rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: small;
		color: inherit;
		cursor: pointer;
	}

	.checkbox-label input {
		width: auto;
	}
</style>
