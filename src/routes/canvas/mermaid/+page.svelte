<script lang="ts">
	import mermaid from "mermaid"
	import { page } from "$app/state"
	import PromptBar from "../PromptBar.svelte"
	import { CANVAS_TOOLS, shouldShowToolTabs } from "../tools"

	mermaid.initialize({ startOnLoad: false, theme: "neutral" })

	let code = $state("")
	let prompt = $state("")
	let isLoading = $state(false)
	let errorMessage = $state("")
	let isEditing = $state(false)
	let svg = $state("")
	let renderError = $state("")

	const submitPrompt = async () => {
		if (!prompt.trim() || isLoading) return
		isLoading = true
		errorMessage = ""
		const prevCode = code
		try {
			const res = await fetch("/api/canvas/mermaid", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ diagram: code, prompt })
			})
			if (!res.ok) {
				const err = await res.json().catch(() => ({}))
				throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`)
			}
			const data = (await res.json()) as { diagram: string }
			code = data.diagram
			prompt = ""
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : "Ukjent feil"
			code = prevCode
		} finally {
			isLoading = false
		}
	}

	$effect(() => {
		const currentCode = code
		if (!currentCode.trim()) {
			svg = ""
			renderError = ""
			return
		}
		let cancelled = false
		const id = `mermaid-diagram-${Math.random().toString(36).slice(2)}`
		mermaid
			.render(id, currentCode)
			.then((result) => {
				if (!cancelled) {
					svg = result.svg
					renderError = ""
				}
			})
			.catch((e: unknown) => {
				if (!cancelled) {
					renderError = e instanceof Error ? e.message : "Ugyldig diagram-syntaks"
				}
			})
		return () => {
			cancelled = true
		}
	})

	const downloadImage = () => {
		if (!svg) return
		const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
		const svgUrl = URL.createObjectURL(svgBlob)
		const img = new Image()
		img.onload = () => {
			const scale = 2
			const canvas = document.createElement("canvas")
			canvas.width = img.width * scale
			canvas.height = img.height * scale
			const ctx = canvas.getContext("2d")
			if (ctx) {
				ctx.scale(scale, scale)
				ctx.fillStyle = "white"
				ctx.fillRect(0, 0, img.width, img.height)
				ctx.drawImage(img, 0, 0)
			}
			canvas.toBlob((blob) => {
				if (!blob) return
				const pngUrl = URL.createObjectURL(blob)
				const a = document.createElement("a")
				a.href = pngUrl
				a.download = "diagram.png"
				a.click()
				URL.revokeObjectURL(pngUrl)
			}, "image/png")
			URL.revokeObjectURL(svgUrl)
		}
		img.src = svgUrl
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
			<button onclick={() => (isEditing = !isEditing)} disabled={!code} title={isEditing ? "Forhåndsvis" : "Rediger kode"}>
				<span class="material-symbols-outlined">{isEditing ? "preview" : "code"}</span>
				{isEditing ? "Forhåndsvis" : "Rediger kode"}
			</button>
			<button onclick={downloadImage} disabled={!svg} title="Last ned som bilde">
				<span class="material-symbols-outlined">download</span>
				Last ned
			</button>
		</div>
	</div>

	<div class="canvas-body">
		<div class="canvas-content">
			<div class="canvas-paper">
				{#if isEditing}
					<textarea class="document-editor" bind:value={code} placeholder="mermaid diagramkode..."></textarea>
				{:else if renderError}
					<p class="empty-hint error-hint">Kunne ikke rendre diagrammet: {renderError}</p>
				{:else if svg}
					{@html svg}
				{:else}
					<p class="empty-hint">Ingen diagram enda. Skriv en instruksjon nedenfor for å komme i gang.</p>
				{/if}
			</div>
		</div>
	</div>

	<div class="canvas-bottom">
		{#if errorMessage}
			<div class="error-banner">{errorMessage}</div>
		{/if}
		<PromptBar bind:value={prompt} placeholder="Beskriv hvilket diagram du vil lage…" {isLoading} sendDisabled={!prompt.trim()} onSubmit={submitPrompt} />
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
		max-width: 210mm;
		align-self: flex-start;
	}

	.canvas-paper {
		background: white;
		border-radius: 2px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04);
		padding: 25mm 20mm;
		width: 100%;
		min-height: 297mm;
		box-sizing: border-box;
		display: flex;
		align-items: flex-start;
		justify-content: center;
	}

	.empty-hint {
		color: #aaa;
		font-style: italic;
	}

	.error-hint {
		color: var(--color-danger);
	}

	.document-editor {
		width: 100%;
		min-height: 247mm;
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
		max-width: 210mm;
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
			min-height: 40vh;
		}

		.document-editor {
			min-height: 30vh;
		}
	}
</style>
