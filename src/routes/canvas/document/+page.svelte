<script lang="ts">
	import { Document, Packer, Paragraph, TextRun } from "docx"
	import { markdownFormatter } from "$lib/formatting/markdown-formatter"
	import { parseSse } from "$lib/streaming"
	import PromptBar from "../PromptBar.svelte"

	let docContent = $state("")
	let prompt = $state("")
	let isLoading = $state(false)
	let errorMessage = $state("")
	let isEditing = $state(false)
	let webSearchEnabled = $state(false)
	let documentEditor: HTMLTextAreaElement | undefined = $state()
	let canvasBody: HTMLDivElement | undefined = $state()

	$effect(() => {
		if (isEditing && documentEditor) {
			documentEditor.style.height = `${documentEditor.scrollHeight}px`
		}
	})

	const submitPrompt = async () => {
		if (!prompt.trim() || isLoading) return
		isLoading = true
		errorMessage = ""
		const prevDocument = docContent
		try {
			const res = await fetch("/api/canvas", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					document: docContent,
					prompt,
					webSearch: webSearchEnabled
				})
			})
			if (!res.ok) {
				const err = await res.json().catch(() => ({}))
				throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`)
			}
			if (!res.body) throw new Error("Ingen respons fra serveren")

			docContent = ""

			const citations: { url: string; title: string }[] = []

			const reader = res.body.getReader()
			const decoder = new TextDecoder("utf-8")
			let buffer = ""

			const processEvents = (chunk: string) => {
				buffer += chunk
				const boundary = buffer.lastIndexOf("\n\n")
				if (boundary === -1) return
				const complete = buffer.slice(0, boundary + 2)
				buffer = buffer.slice(boundary + 2)
				for (const event of parseSse(complete)) {
					if (event.event === "response.output_text.delta") {
						docContent += event.data.content
					} else if (event.event === "response.annotations") {
						for (const a of event.data.annotations) {
							if (!citations.find((c) => c.url === a.url)) {
								citations.push({ url: a.url, title: a.title })
							}
						}
					} else if (event.event === "response.error") {
						throw new Error(event.data.message)
					}
				}
			}

			while (true) {
				const { value, done } = await reader.read()
				processEvents(decoder.decode(value, { stream: !done }))
				if (done) break
			}

			if (citations.length > 0) {
				const sourcesSection = `\n\n---\n\n## Kilder\n\n${citations.map((c, i) => `${i + 1}. [${c.title}](${c.url})`).join("\n")}`
				docContent += sourcesSection
			}
			prompt = ""
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : "Ukjent feil"
			docContent = prevDocument
		} finally {
			isLoading = false
		}
	}

	const downloadText = () => {
		const blob = new Blob([docContent], { type: "text/plain" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = "canvas.txt"
		a.click()
		URL.revokeObjectURL(url)
	}

	const parseInline = (text: string): TextRun[] => {
		const runs: TextRun[] = []
		const re = /\*\*\*(.+?)\*\*\*|___(.+?)___|\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*/g
		let last = 0
		let match = re.exec(text)
		while (match !== null) {
			if (match.index > last) runs.push(new TextRun(text.slice(last, match.index)))
			if (match[1] !== undefined) runs.push(new TextRun({ text: match[1], bold: true, italics: true }))
			else if (match[2] !== undefined) runs.push(new TextRun({ text: match[2], bold: true, italics: true }))
			else if (match[3] !== undefined) runs.push(new TextRun({ text: match[3], bold: true }))
			else if (match[4] !== undefined) runs.push(new TextRun({ text: match[4], bold: true }))
			else if (match[5] !== undefined) runs.push(new TextRun({ text: match[5], italics: true }))
			else if (match[6] !== undefined) runs.push(new TextRun({ text: match[6], italics: true }))
			last = match.index + match[0].length
			match = re.exec(text)
		}
		if (last < text.length) runs.push(new TextRun(text.slice(last)))
		return runs
	}

	const downloadDocx = async () => {
		const lines = docContent.split("\n")
		const paragraphs: Paragraph[] = []

		for (const line of lines) {
			if (/^---+$/.test(line.trim())) {
				paragraphs.push(new Paragraph({ border: { bottom: { style: "single", size: 6, color: "999999", space: 1 } } }))
			} else if (line.startsWith("# ")) {
				paragraphs.push(new Paragraph({ heading: "Heading1", children: parseInline(line.slice(2)) }))
			} else if (line.startsWith("## ")) {
				paragraphs.push(new Paragraph({ heading: "Heading2", children: parseInline(line.slice(3)) }))
			} else if (line.startsWith("### ")) {
				paragraphs.push(new Paragraph({ heading: "Heading3", children: parseInline(line.slice(4)) }))
			} else if (/^[-*] /.test(line)) {
				paragraphs.push(new Paragraph({ bullet: { level: 0 }, children: parseInline(line.slice(2)) }))
			} else if (line.trim() === "") {
				paragraphs.push(new Paragraph(""))
			} else {
				paragraphs.push(new Paragraph({ children: parseInline(line) }))
			}
		}

		const doc = new Document({ sections: [{ children: paragraphs }] })
		const blob = await Packer.toBlob(doc)
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = "canvas.docx"
		a.click()
		URL.revokeObjectURL(url)
	}
</script>

<div class="document-page">
	<div class="canvas-topbar">
		<button onclick={() => (isEditing = !isEditing)} disabled={!docContent} title={isEditing ? "Forhåndsvis" : "Rediger"}>
			<span class="material-symbols-outlined">{isEditing ? "preview" : "edit"}</span>
			{isEditing ? "Forhåndsvis" : "Rediger"}
		</button>
		<div class="export-buttons">
			<button onclick={downloadText} disabled={!docContent} title="Last ned som tekstfil">
				<span class="material-symbols-outlined">download</span>
				Tekst
			</button>
			<button onclick={downloadDocx} disabled={!docContent} title="Last ned som Word-dokument">
				<span class="material-symbols-outlined">download</span>
				Word
			</button>
		</div>
	</div>

	<div class="canvas-body" bind:this={canvasBody}>
		<div class="canvas-content">
			<header class="canvas-header">
				<h1>Kladdeboka</h1>
				<p>Skriv og bearbeid dokumenter sammen med kunstig intelligens. Beskriv hva du vil ha, så hjelper Hugin deg med å skrive og redigere. Du kan også redigere dokumentet selv. Bruk funksjonene på toppen av siden.</p>
			</header>
			<div class="canvas-paper">
				{#if isEditing}
					<textarea
						class="document-editor"
						bind:this={documentEditor}
						bind:value={docContent}
						oninput={(e) => {
							const t = e.currentTarget
							const scroll = canvasBody?.scrollTop ?? 0
							t.style.height = "auto"
							t.style.height = t.scrollHeight + "px"
							if (canvasBody) canvasBody.scrollTop = scroll
						}}
					></textarea>
				{:else if docContent}
					{@html markdownFormatter(docContent)}
				{:else}
					<p class="empty-hint">Dokumentet er tomt. Skriv en instruksjon nedenfor for å komme i gang.</p>
				{/if}
			</div>
		</div>
	</div>

	<div class="canvas-bottom">
		{#if errorMessage}
			<div class="error-banner">{errorMessage}</div>
		{/if}
		<PromptBar bind:value={prompt} placeholder="Beskriv hva du vil gjøre med dokumentet…" {isLoading} sendDisabled={!prompt.trim()} onSubmit={submitPrompt}>
			{#snippet actions()}
				<button
					class="icon-button input-action-button"
					class:active={webSearchEnabled}
					onclick={() => (webSearchEnabled = !webSearchEnabled)}
					title={webSearchEnabled ? "Websøk aktivert" : "Websøk deaktivert"}
					type="button"
				>
					<span class="material-symbols-outlined">travel_explore</span>
				</button>
			{/snippet}
		</PromptBar>
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
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem 1.5rem;
		background-color: #f0f0ef;
		border-bottom: 1px solid var(--color-primary-30);
		flex-shrink: 0;
	}

	.export-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.export-buttons button {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: small;
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

	.canvas-header {
		margin-bottom: 1.5rem;
	}

	.canvas-header h1 {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
		color: var(--color-primary);
	}

	.canvas-header p {
		margin: 0 0 0.35rem;
		color: var(--color-primary-80);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.canvas-header p:last-child {
		margin-bottom: 0;
	}

	.canvas-paper {
		background: white;
		border-radius: 2px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04);
		padding: 25mm 20mm;
		width: 100%;
		min-height: 297mm;
		box-sizing: border-box;
	}

	.empty-hint {
		color: #aaa;
		font-style: italic;
	}

	.document-editor {
		width: 100%;
		min-height: 247mm;
		border: none;
		outline: none;
		resize: none;
		font: inherit;
		line-height: 1.6;
		background: transparent;
		box-sizing: border-box;
	}

	.canvas-bottom {
		flex-shrink: 0;
		padding: 0.75rem 1.5rem;
		background-color: #f0f0ef;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-action-button {
		padding: 0.5rem 0.375rem;
	}

	.input-action-button.active {
		color: var(--color-primary);
		background-color: var(--color-primary-20);
		border-radius: 50%;
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
