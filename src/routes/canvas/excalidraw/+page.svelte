<script lang="ts">
	import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"
	import { page } from "$app/state"
	import ExcalidrawCanvas from "$lib/components/Excalidraw/ExcalidrawCanvas.svelte"
	import PromptBar from "../PromptBar.svelte"
	import { CANVAS_TOOLS, shouldShowToolTabs } from "../tools"

	// Prototype: the LLM still writes Mermaid (same /api/canvas/mermaid endpoint and prompt as the Diagram
	// tab). The browser converts it to Excalidraw elements, which the user can then move and draw on.
	// Flowchart, sequence, class, ER and state become editable shapes; other types become one image.

	let api: ExcalidrawImperativeAPI | undefined = $state()
	let code = $state("")
	let prompt = $state("")
	let isLoading = $state(false)
	let errorMessage = $state("")
	let showCode = $state(false)

	const renderMermaid = async (mermaidCode: string) => {
		if (!api) return
		const [{ parseMermaidToExcalidraw }, { convertToExcalidrawElements }] = await Promise.all([import("@excalidraw/mermaid-to-excalidraw"), import("@excalidraw/excalidraw")])
		const { elements, files } = await parseMermaidToExcalidraw(mermaidCode)
		api.updateScene({ elements: convertToExcalidrawElements(elements) })
		if (files) {
			api.addFiles(Object.values(files))
		}
		api.scrollToContent(undefined, { fitToContent: true })
	}

	const submitPrompt = async () => {
		if (!prompt.trim() || isLoading) return
		isLoading = true
		errorMessage = ""
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
			await renderMermaid(data.diagram)
			code = data.diagram
			prompt = ""
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : "Ukjent feil"
		} finally {
			isLoading = false
		}
	}

	const download = (blob: Blob, filename: string) => {
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = filename
		a.click()
		URL.revokeObjectURL(url)
	}

	const downloadPng = async () => {
		if (!api) return
		const { exportToBlob } = await import("@excalidraw/excalidraw")
		const blob = await exportToBlob({
			elements: api.getSceneElements(),
			appState: { ...api.getAppState(), exportBackground: true, viewBackgroundColor: "#ffffff" },
			files: api.getFiles(),
			mimeType: "image/png",
			exportPadding: 20
		})
		download(blob, "diagram.png")
	}

	// A .excalidraw file opens on excalidraw.com or in the Excalidraw VS Code extension
	const downloadExcalidraw = async () => {
		if (!api) return
		const { serializeAsJSON } = await import("@excalidraw/excalidraw")
		const json = serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), "local")
		download(new Blob([json], { type: "application/json" }), "diagram.excalidraw")
	}
</script>

<div class="excalidraw-page">
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
			<button onclick={() => (showCode = !showCode)} disabled={!code} title="Vis Mermaid-koden modellen laget">
				<span class="material-symbols-outlined">code</span>
				{showCode ? "Skjul kode" : "Vis kode"}
			</button>
			<button onclick={downloadPng} disabled={!api} title="Last ned som PNG">
				<span class="material-symbols-outlined">download</span>
				PNG
			</button>
			<button onclick={downloadExcalidraw} disabled={!api} title="Last ned som .excalidraw-fil">
				<span class="material-symbols-outlined">file_save</span>
				.excalidraw
			</button>
		</div>
	</div>

	<div class="canvas-body">
		{#if showCode}
			<pre class="code-panel">{code}</pre>
		{/if}
		<div class="excalidraw-frame">
			<ExcalidrawCanvas onReady={(excalidrawApi) => (api = excalidrawApi)} />
		</div>
	</div>

	<div class="canvas-bottom">
		{#if errorMessage}
			<div class="error-banner">{errorMessage}</div>
		{/if}
		{#if code}
			<div class="hint">En ny instruksjon lager diagrammet på nytt fra koden – manuelle endringer i tegningen blir overskrevet.</div>
		{/if}
		<PromptBar bind:value={prompt} placeholder="Beskriv hvilket diagram du vil lage…" {isLoading} sendDisabled={!prompt.trim() || !api} onSubmit={submitPrompt} />
	</div>
</div>

<style>
	.excalidraw-page {
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
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding: 1rem 1.5rem;
		gap: 0.75rem;
	}

	.excalidraw-frame {
		flex: 1;
		min-height: 400px;
		border: 1px solid var(--color-primary-20);
		border-radius: 4px;
		overflow: hidden;
		background: white;
	}

	.code-panel {
		max-height: 25vh;
		overflow: auto;
		margin: 0;
		padding: 0.75rem;
		background: #f7f7f6;
		border-radius: 4px;
		font-size: 0.8rem;
	}

	.canvas-bottom {
		flex-shrink: 0;
		width: 100%;
		max-width: 297mm;
		align-self: center;
		padding: 0.75rem 1.5rem;
		background-color: #f0f0ef;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		box-sizing: border-box;
	}

	.hint {
		font-size: small;
		color: #666;
	}

	.error-banner {
		padding: 0.4rem 0.75rem;
		background-color: #fde8e8;
		border-left: 3px solid #d32f2f;
		border-radius: 4px;
		font-size: small;
		color: #b71c1c;
	}
</style>
