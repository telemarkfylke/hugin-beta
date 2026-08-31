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
	let isEditing = $state(false)

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
		if (!isEditing) deck?.sync()
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

<div class="document-page">
	<div class="canvas-topbar">
		{#if shouldShowToolTabs(CANVAS_TOOLS)}
			<nav class="canvas-tabs">
				{#each CANVAS_TOOLS as tool (tool.id)}
					<a class="canvas-tab" class:active={page.url.pathname.startsWith(tool.href)} href={tool.href}>
						<span class="material-symbols-outlined">{tool.icon}</span>
						{tool.label}
					</a>
				{/each}
			</nav>
		{/if}
		<div class="topbar-actions">
			<button onclick={() => (isEditing = !isEditing)} disabled={!slidesMarkdown} title={isEditing ? "Forhåndsvis" : "Rediger kode"}>
				<span class="material-symbols-outlined">{isEditing ? "preview" : "code"}</span>
				{isEditing ? "Forhåndsvis" : "Rediger kode"}
			</button>
		</div>
	</div>

	<div class="canvas-body">
		<div class="canvas-content">
			{#if isEditing}
				<div class="canvas-paper">
					<textarea class="document-editor" bind:value={slidesMarkdown} placeholder="# Tittel&#10;---&#10;## Slide 2"></textarea>
				</div>
			{:else}
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
			{/if}
		</div>
	</div>

	<div class="canvas-bottom">
		{#if errorMessage}
			<div class="error-banner">{errorMessage}</div>
		{/if}
		<PromptBar bind:value={prompt} placeholder="Beskriv hvilken presentasjon du vil lage…" {isLoading} sendDisabled={!prompt.trim()} onSubmit={submitPrompt} />
	</div>
</div>

<style>
	.document-page {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;
		min-height: 0;
	}

	.canvas-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem 1.5rem;
		background-color: #f0f0ef;
		border-bottom: 1px solid var(--color-primary-30);
		flex-shrink: 0;
	}

	.canvas-tabs {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		white-space: nowrap;
	}

	.canvas-tab {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.35rem 0.75rem;
		border-radius: 14px;
		color: var(--color-primary);
		flex-shrink: 0;
		text-decoration: none;
	}

	.canvas-tab.active {
		background-color: var(--color-primary);
		color: white;
		font-weight: 700;
	}

	.topbar-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.canvas-body {
		flex: 1;
		overflow-y: auto;
		padding: 2rem 1.5rem;
		display: flex;
		justify-content: center;
	}

	.canvas-content {
		width: 100%;
		max-width: 960px;
		align-self: flex-start;
	}

	.canvas-paper {
		background: white;
		border-radius: 2px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04);
		padding: 20mm 25mm;
		width: 100%;
		box-sizing: border-box;
	}

	.reveal {
		width: 100%;
		aspect-ratio: 16 / 9;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04);
	}

	.empty-hint {
		color: #aaa;
		font-style: italic;
	}

	.document-editor {
		width: 100%;
		min-height: 160mm;
		border: none;
		outline: none;
		resize: none;
		font-family: monospace;
		line-height: 1.6;
		background: transparent;
		box-sizing: border-box;
	}

	.canvas-bottom {
		flex-shrink: 0;
		width: 100%;
		max-width: 960px;
		align-self: center;
		padding: 0.75rem 1.5rem;
		background-color: #f0f0ef;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		box-sizing: border-box;
	}

	.error-banner {
		padding: 0.4rem 0.75rem;
		background-color: #fde8e8;
		border-left: 3px solid #d32f2f;
		border-radius: 4px;
		font-size: small;
		color: #b71c1c;
	}

	@media (max-width: 768px) {
		.canvas-body {
			padding: 1rem;
		}

		.canvas-paper {
			padding: 1rem;
		}

		.document-editor {
			min-height: 30vh;
		}
	}
</style>
