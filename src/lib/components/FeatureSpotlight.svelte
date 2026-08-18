<script lang="ts">
	import { browser } from "$app/environment"
	import { fade } from "svelte/transition"
	import { simpleMarkdownFormatter } from "$lib/formatting/simple-markdown-formatter"
	import { dismissSpotlightPermanently, isSpotlightDismissed } from "$lib/util/spotlight-util"

	// Four independent, composable concerns, each owned by its own module:
	// - content: header/icon/text/subtext props, rendered via simpleMarkdownFormatter below
	// - positioning: FixedPlacement, applied via the class: bindings below - fixed corners only,
	//   no anchored/pinned-to-an-element mode (removed - see git history if that's ever needed
	//   again, but a real positioning/tour library is a better foundation than reviving this)
	// - dismissal: spotlight-util.ts (localStorage), read into `dismissedPermanently`
	// - audience: not this component's concern at all - callers gate the `active` prop with
	//   canSeeSpotlight from $lib/authorization (see README's "Restricting the audience")
	type FixedPlacement = "center" | "top-center" | "top-right" | "bottom-right" | "bottom-center" | "bottom-left" | "top-left"

	type Props = {
		id: string
		// `| undefined` (not just `?`) on these four: SpotlightHost passes them straight through
		// from a data object where they're optional, so the value can be the literal `undefined`,
		// not just omitted - exactOptionalPropertyTypes (see tsconfig.json) treats those differently.
		icon?: string | undefined
		header: string
		text: string
		subtext?: string | undefined
		active?: boolean
		backdrop?: boolean | undefined
		placement?: FixedPlacement | undefined
		onDismiss?: () => void
	}

	let {
		id,
		icon,
		header,
		text,
		subtext,
		active = true,
		backdrop = false,
		placement = "top-center",
		onDismiss
	}: Props = $props()

	// Computed synchronously (not in an $effect) so the very first render already
	// reflects dismissal state - an $effect only runs after that first render commits,
	// which would flash the box visible for a frame before hiding it.
	let dismissedPermanently = $derived(isSpotlightDismissed(id))
	let closedThisSession = $state(false)
	let dontShowAgain = $state(false)

	// `browser` gates this too: server-rendered HTML can't know the real localStorage
	// dismissal state (see isSpotlightDismissed), so rendering nothing until we're
	// definitely on the client avoids a wrong-then-corrected flash on SSR'd routes.
	let visible = $derived(browser && active && !dismissedPermanently && !closedThisSession)
	let renderedText = $derived(simpleMarkdownFormatter(text))

	const close = () => {
		if (dontShowAgain) dismissSpotlightPermanently(id)
		closedThisSession = true
		onDismiss?.()
	}
</script>

{#if visible}
	{#if backdrop}
		<div class="spotlight-backdrop" transition:fade={{ duration: 150 }}></div>
	{/if}
	<div
		class="spotlight"
		class:center={placement === "center"}
		class:top-center={placement === "top-center"}
		class:top-right={placement === "top-right"}
		class:bottom-right={placement === "bottom-right"}
		class:bottom-center={placement === "bottom-center"}
		class:bottom-left={placement === "bottom-left"}
		class:top-left={placement === "top-left"}
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
				<div class="spotlight-body">{@html renderedText}</div>
				{#if subtext}<p class="spotlight-subtext">{subtext}</p>{/if}
			</div>
		</div>
		<div class="spotlight-footer">
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={dontShowAgain} />
				Ikke vis denne igjen
			</label>
			<button onclick={close}>Lukk</button>
		</div>
	</div>
{/if}

<style>
	.spotlight-backdrop {
		position: fixed;
		inset: 0;
		z-index: 149;
		background-color: rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(2px);
	}

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

	.spotlight.top-center {
		top: 5rem;
		left: 50%;
		transform: translateX(-50%);
	}
	.spotlight.top-right {
		top: 1rem;
		right: 1rem;
	}
	.spotlight.bottom-right {
		bottom: 2rem;
		right: 1rem;
	}
	.spotlight.bottom-left {
		bottom: 2rem;
		left: 1rem;
	}
	.spotlight.bottom-center {
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
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

	.spotlight-body :global(p) {
		margin: 0 0 0.5rem 0;
		font-size: 0.9rem;
		line-height: 1.4;
	}
	.spotlight-body :global(p:last-child) {
		margin-bottom: 0;
	}

	/* Deliberately does NOT mimic a real button (no pointer cursor, no hover state) -
	   this is a reference chip for "this is what to look for", not a clickable control. */
	.spotlight-body :global(.spotlight-pill) {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		background-color: var(--color-primary-10);
		color: var(--color-primary);
		border-radius: 4px;
		padding: 0.05rem 0.4rem;
		font-weight: 600;
		white-space: nowrap;
		cursor: default;
	}
	.spotlight-body :global(.spotlight-pill .material-symbols-rounded) {
		font-size: 1em;
		vertical-align: -0.15em;
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

	.spotlight-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
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
