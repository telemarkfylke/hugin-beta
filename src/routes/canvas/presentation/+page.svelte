<script lang="ts">
	import { onMount } from "svelte"
	import Reveal, { type RevealApi } from "reveal.js"
	import "reveal.js/reveal.css"
	import "reveal.js/theme/white.css"
	import { page } from "$app/state"
	import { markdownFormatter } from "$lib/formatting/markdown-formatter"
	import PromptBar from "../PromptBar.svelte"
	import { CANVAS_TOOLS, shouldShowToolTabs } from "../tools"

	let slidesMarkdown = $state("")
	let prompt = $state("")
	let isLoading = $state(false)
	let errorMessage = $state("")

	let slides = $derived(
		slidesMarkdown
			.split(/^\s*---\s*$/m)
			.map((s) => s.trim())
			.filter((s) => s.length > 0)
	)

	let deckContainer: HTMLDivElement | undefined = $state()
	let deck: RevealApi | undefined

	onMount(() => {
		if (!deckContainer) return
		deck = new Reveal(deckContainer, { embedded: true, controls: true, progress: true, center: true })
		deck.initialize()
	})

	$effect(() => {
		slides
		deck?.sync()
	})

	const submitPrompt = async () => {
		if (!prompt.trim() || isLoading) return
		isLoading = true
		errorMessage = ""
		const prevSlides = slidesMarkdown
		try {
			const res = await fetch("/api/canvas/presentation", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slides: slidesMarkdown, prompt })
			})
			if (!res.ok) {
				const err = await res.json().catch(() => ({}))
				throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`)
			}
			const data = (await res.json()) as { slides: string }
			slidesMarkdown = data.slides
			prompt = ""
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : "Ukjent feil"
			slidesMarkdown = prevSlides
		} finally {
			isLoading = false
		}
	}
</script>

<div class="presentation-mode">
	{#if shouldShowToolTabs(CANVAS_TOOLS)}
		<nav class="canvas-tabs">
			{#each CANVAS_TOOLS as tool (tool.id)}
				<a class="canvas-tab" class:active={page.url.pathname === tool.href} href={tool.href}>
					<span class="material-symbols-outlined">{tool.icon}</span>
					{tool.label}
				</a>
			{/each}
		</nav>
	{/if}

	<div class="reveal" bind:this={deckContainer}>
		<div class="slides">
			{#if slides.length > 0}
				{#each slides as slideMarkdown}
					<section>{@html markdownFormatter(slideMarkdown)}</section>
				{/each}
			{:else}
				<section><p class="empty-hint">Presentasjonen er tom. Skriv en instruksjon nedenfor for å komme i gang.</p></section>
			{/if}
		</div>
	</div>

	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}

	<PromptBar bind:value={prompt} onSubmit={submitPrompt} {isLoading} sendDisabled={isLoading} placeholder="Beskriv hvilken presentasjon du vil lage..." />
</div>

<style>
	.presentation-mode {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
	.reveal {
		flex: 1;
		min-height: 0;
	}
	.error {
		color: var(--color-error, #b00020);
	}
</style>