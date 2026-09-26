<script lang="ts">
	import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"
	import { onMount } from "svelte"
	import { page } from "$app/state"
	import ExcalidrawCanvas from "$lib/components/Excalidraw/ExcalidrawCanvas.svelte"
	import { DIAGRAM_STYLE_STORAGE_KEY, DIAGRAM_STYLES, type DiagramStyle, diagramStyleUpdates, parseDiagramStyle, sceneFingerprint, styleSkeleton } from "$lib/diagram/diagram-style"
	import { cleanSkeletonText, sanitizeMermaid } from "$lib/diagram/sanitize-mermaid"
	import PromptBar from "../PromptBar.svelte"
	import { CANVAS_TOOLS, shouldShowToolTabs } from "../tools"

	// The LLM writes Mermaid (/api/canvas/mermaid); the browser converts it to Excalidraw elements, which the
	// user can then move and draw on. Flowchart, sequence, class, ER and state become editable shapes; other
	// diagram types become a single image. A new prompt or "Oppdater tegning" regenerates the drawing from the
	// code, so manual edits in the drawing are replaced.

	// $state.raw: the imperative API is a plain object Svelte shouldn't deep-proxy
	let api: ExcalidrawImperativeAPI | undefined = $state.raw()
	let code = $state("")
	let codeDraft = $state("")
	let prompt = $state("")
	let isLoading = $state(false)
	let errorMessage = $state("")
	let isEditingCode = $state(false)
	let style: DiagramStyle = $state("sketch")
	// Fingerprint of the drawing right after it was generated - if unchanged, nothing was edited by hand
	let generatedFingerprint = ""

	onMount(() => {
		try {
			style = parseDiagramStyle(localStorage.getItem(DIAGRAM_STYLE_STORAGE_KEY))
		} catch {
			// localStorage can be unavailable (privacy mode, cross-origin iframe) - keep the default
		}
	})

	const loadExcalidraw = () => import("@excalidraw/excalidraw")
	const loadConverter = () => import("@excalidraw/mermaid-to-excalidraw")

	// New shapes the user draws follow the chosen style too
	const applyStyleToAppState = (target: ExcalidrawImperativeAPI) => {
		const { roughness, fontFamily } = DIAGRAM_STYLES[style]
		target.updateScene({ appState: { currentItemRoughness: roughness, currentItemFontFamily: fontFamily } })
	}

	// Mermaid -> Excalidraw skeletons. Throws on invalid Mermaid - the only error the repair loop may fix.
	const parseMermaid = async (mermaidCode: string) => {
		const { parseMermaidToExcalidraw } = await loadConverter()
		return parseMermaidToExcalidraw(mermaidCode)
	}

	const drawScene = async ({ elements, files }: Awaited<ReturnType<typeof parseMermaid>>) => {
		if (!api) throw new Error("Excalidraw er ikke klar")
		const { convertToExcalidrawElements, newElementWith, CaptureUpdateAction } = await loadExcalidraw()
		const converted = convertToExcalidrawElements(elements.map((skeleton) => styleSkeleton(cleanSkeletonText(skeleton), style)))
		const styled = converted.map((element) => newElementWith(element, { roughness: DIAGRAM_STYLES[style].roughness }))
		// Files first, so image elements never reference a file that isn't added yet
		if (files) {
			api.addFiles(Object.values(files))
		}
		// IMMEDIATELY: a regenerated drawing is one undo step, so Ctrl+Z brings back the previous one
		api.updateScene({ elements: styled, captureUpdate: CaptureUpdateAction.IMMEDIATELY })
		applyStyleToAppState(api)
		api.scrollToContent(undefined, { fitToContent: true })
		generatedFingerprint = sceneFingerprint(api.getSceneElements())
	}

	const renderMermaid = async (mermaidCode: string) => drawScene(await parseMermaid(mermaidCode))

	const setStyle = async (next: DiagramStyle) => {
		style = next
		try {
			localStorage.setItem(DIAGRAM_STYLE_STORAGE_KEY, next)
		} catch {
			// Not persisted - the choice still applies for this session
		}
		if (!api || isLoading) return
		// Untouched drawing: redraw from the code, which lays text out perfectly for the new font
		if (code && sceneFingerprint(api.getSceneElements()) === generatedFingerprint) {
			await renderMermaid(code)
			return
		}
		// Edited by hand: restyle in place to keep the edits. Re-wrap text from its original (unwrapped) text,
		// since the two fonts have different widths.
		const { newElementWith, restoreElements } = await loadExcalidraw()
		const restyled = api.getSceneElements().map((element) => newElementWith(element, { ...diagramStyleUpdates(element, next), ...(element.type === "text" ? { text: element.originalText } : {}) }))
		api.updateScene({ elements: restoreElements(restyled, null, { refreshDimensions: true }) })
		applyStyleToAppState(api)
	}

	// Thrown for network/HTTP/session failures, so they aren't mistaken for (repairable) Mermaid syntax errors
	class RequestError extends Error {}

	const requestDiagram = async (diagram: string, instruction: string): Promise<string> => {
		let res: Response
		let data: { diagram?: unknown; message?: unknown }
		try {
			res = await fetch("/api/canvas/mermaid", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ diagram, prompt: instruction })
			})
			data = await res.json().catch(() => ({}))
		} catch {
			throw new RequestError("Fikk ikke kontakt med tjenesten. Sjekk nettverket, eller last siden på nytt hvis du har vært borte en stund.")
		}
		if (!res.ok) {
			throw new RequestError(typeof data.message === "string" ? data.message : `Tjenesten svarte med feil (${res.status})`)
		}
		if (typeof data.diagram !== "string") {
			throw new RequestError("Uventet svar fra tjenesten. Last siden på nytt og prøv igjen.")
		}
		return sanitizeMermaid(data.diagram)
	}

	// The model occasionally writes Mermaid that doesn't parse. Instead of showing the parser's error, send it
	// back to the model to fix (up to MAX_REPAIRS times). Only parse errors are repaired - anything else
	// (network, a failed lazy import, Excalidraw itself) is thrown straight out. The previous drawing is kept
	// until a parse succeeds.
	const MAX_REPAIRS = 2
	const parseWithRepair = async (firstAttempt: string) => {
		await Promise.all([loadConverter(), loadExcalidraw()])
		let attempt = firstAttempt
		for (let repair = 0; ; repair++) {
			try {
				return { mermaidCode: attempt, parsed: await parseMermaid(attempt) }
			} catch (e) {
				if (repair >= MAX_REPAIRS) throw e
				const parseError = e instanceof Error ? e.message : String(e)
				attempt = await requestDiagram(attempt, `The diagram source above fails to parse with this error:\n${parseError}\nFix it and return only valid Mermaid, keeping the same content.`)
			}
		}
	}

	const submitPrompt = async () => {
		if (!prompt.trim() || isLoading) return
		isLoading = true
		errorMessage = ""
		try {
			const { mermaidCode, parsed } = await parseWithRepair(await requestDiagram(code, prompt))
			await drawScene(parsed)
			code = mermaidCode
			codeDraft = mermaidCode
			prompt = ""
		} catch (e) {
			errorMessage = e instanceof RequestError ? e.message : "Klarte ikke å lage et gyldig diagram denne gangen. Prøv å formulere instruksjonen litt annerledes."
		} finally {
			isLoading = false
		}
	}

	const toggleCodeEditor = () => {
		codeDraft = code
		isEditingCode = !isEditingCode
	}

	const applyCode = async () => {
		if (!codeDraft.trim() || isLoading) return
		isLoading = true
		errorMessage = ""
		// The user's own code: clean known-invalid style values, but show a real syntax error - it helps
		// someone who is editing the code directly
		const cleaned = sanitizeMermaid(codeDraft)
		try {
			await renderMermaid(cleaned)
			code = cleaned
			codeDraft = cleaned
		} catch (e) {
			errorMessage = `Koden inneholder en feil: ${e instanceof Error ? e.message.split("\n")[0] : "ugyldig Mermaid-syntaks"}`
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
		const { exportToBlob } = await loadExcalidraw()
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
		const { serializeAsJSON } = await loadExcalidraw()
		const json = serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), "local")
		download(new Blob([json], { type: "application/json" }), "diagram.excalidraw")
	}
</script>

<div class="diagram-page">
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
			<div class="style-toggle" role="radiogroup" aria-label="Stil">
				{#each Object.entries(DIAGRAM_STYLES) as [id, option] (id)}
					<button role="radio" aria-checked={style === id} class:active={style === id} onclick={() => setStyle(id as DiagramStyle)} disabled={!api}>
						{option.label}
					</button>
				{/each}
			</div>
			<button onclick={toggleCodeEditor} title={isEditingCode ? "Skjul koden" : "Rediger Mermaid-koden"}>
				<span class="material-symbols-outlined">code</span>
				{isEditingCode ? "Skjul kode" : "Rediger kode"}
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
		{#if isEditingCode}
			<div class="code-editor">
				<textarea bind:value={codeDraft} placeholder="Mermaid-diagramkode, f.eks. flowchart TD&#10;  A[Start] --> B[Slutt]" spellcheck="false"></textarea>
				<button class="apply-code" onclick={applyCode} disabled={!codeDraft.trim() || codeDraft === code || !api || isLoading}>
					<span class="material-symbols-outlined">refresh</span>
					Oppdater tegning
				</button>
			</div>
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
	.diagram-page {
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

	.style-toggle {
		display: flex;
		border: 1px solid var(--color-primary-30);
		border-radius: 14px;
		overflow: hidden;
	}

	.style-toggle button {
		border: none;
		border-radius: 0;
		padding: 0.3rem 0.75rem;
		background: transparent;
		color: var(--color-primary);
	}

	.style-toggle button.active {
		background-color: var(--color-primary);
		color: white;
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

	.code-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.code-editor textarea {
		min-height: 8rem;
		max-height: 30vh;
		resize: vertical;
		padding: 0.75rem;
		font-family: monospace;
		font-size: 0.85rem;
		line-height: 1.5;
		border: 1px solid var(--color-primary-20);
		border-radius: 4px;
		background: #f7f7f6;
	}

	.apply-code {
		align-self: flex-start;
		display: flex;
		align-items: center;
		gap: 0.25rem;
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

	@media (max-width: 768px) {
		.canvas-body {
			padding: 0.75rem;
		}
	}
</style>
