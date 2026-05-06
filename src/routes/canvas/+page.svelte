<script lang="ts">
	import { Document, Packer, Paragraph, TextRun } from "docx"
	import TypingDots from "$lib/components/TypingDots.svelte"
	import { markdownFormatter } from "$lib/formatting/markdown-formatter"
	import { parseSse } from "$lib/streaming"

	let document = $state("")
	let prompt = $state("")
	let promptWrapDiv: HTMLDivElement = $state() as HTMLDivElement
	let promptTextArea: HTMLTextAreaElement = $state() as HTMLTextAreaElement

	$effect(() => {
		prompt
		if (promptWrapDiv && promptTextArea) {
			promptWrapDiv.setAttribute("data-replicated-value", promptTextArea.value)
		}
	})
	let isLoading = $state(false)
	let errorMessage = $state("")
	let isEditing = $state(false)
	let webSearchEnabled = $state(false)
	let documentEditor: HTMLTextAreaElement | undefined = $state()
	let canvasBody: HTMLDivElement | undefined = $state()

	$effect(() => {
		if (isEditing && documentEditor) {
			documentEditor.style.height = documentEditor.scrollHeight + "px"
		}
	})

	const submitPrompt = async () => {
		if (!prompt.trim() || isLoading) return
		isLoading = true
		errorMessage = ""
		const prevDocument = document
		try {
			const res = await fetch("/api/canvas", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					document,
					prompt,
					webSearch: webSearchEnabled
				})
			})
			if (!res.ok) {
				const err = await res.json().catch(() => ({}))
				throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`)
			}
			if (!res.body) throw new Error("Ingen respons fra serveren")

			document = ""
			prompt = ""

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
						document += event.data.content
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
				const sourcesSection = "\n\n---\n\n## Kilder\n\n" + citations.map((c, i) => `${i + 1}. [${c.title}](${c.url})`).join("\n")
				document += sourcesSection
			}
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : "Ukjent feil"
			if (!document) document = prevDocument
		} finally {
			isLoading = false
		}
	}

	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			submitPrompt()
		}
	}

	const downloadText = () => {
		const blob = new Blob([document], { type: "text/plain" })
		const url = URL.createObjectURL(blob)
		const a = window.document.createElement("a")
		a.href = url
		a.download = "canvas.txt"
		a.click()
		URL.revokeObjectURL(url)
	}

	const parseInline = (text: string): TextRun[] => {
		const runs: TextRun[] = []
		const re = /\*\*(.+?)\*\*|_(.+?)_|\*(.+?)\*/g
		let last = 0
		let match: RegExpExecArray | null
		while ((match = re.exec(text)) !== null) {
			if (match.index > last) runs.push(new TextRun(text.slice(last, match.index)))
			if (match[1] !== undefined) runs.push(new TextRun({ text: match[1], bold: true }))
			else if (match[2] !== undefined) runs.push(new TextRun({ text: match[2], italics: true }))
			else if (match[3] !== undefined) runs.push(new TextRun({ text: match[3], italics: true }))
			last = match.index + match[0].length
		}
		if (last < text.length) runs.push(new TextRun(text.slice(last)))
		return runs
	}

	const downloadDocx = async () => {
		const lines = document.split("\n")
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
		const a = window.document.createElement("a")
		a.href = url
		a.download = "canvas.docx"
		a.click()
		URL.revokeObjectURL(url)
	}
</script>

<div class="canvas-page">
	<!-- Top bar: export buttons -->
	<div class="canvas-topbar">
		<button onclick={() => (isEditing = !isEditing)} disabled={!document} title={isEditing ? "Forhåndsvis" : "Rediger"}>
			<span class="material-symbols-outlined">{isEditing ? "preview" : "edit"}</span>
			{isEditing ? "Forhåndsvis" : "Rediger"}
		</button>
		<div class="export-buttons">
			<button onclick={downloadText} disabled={!document} title="Last ned som tekstfil">
				<span class="material-symbols-outlined">download</span>
				Tekst
			</button>
			<button onclick={downloadDocx} disabled={!document} title="Last ned som Word-dokument">
				<span class="material-symbols-outlined">download</span>
				Word
			</button>
		</div>
	</div>

	<!-- Canvas document area -->
	<div class="canvas-body" bind:this={canvasBody}>
		<div class="canvas-paper">
			{#if isEditing}
				<textarea class="document-editor" bind:this={documentEditor} bind:value={document} oninput={(e) => { const t = e.currentTarget; const scroll = canvasBody?.scrollTop ?? 0; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; if (canvasBody) canvasBody.scrollTop = scroll }}></textarea>
			{:else if document}
				{@html markdownFormatter(document)}
			{:else}
				<p class="empty-hint">Dokumentet er tomt. Skriv en instruksjon nedenfor for å komme i gang.</p>
			{/if}
		</div>
	</div>

	<!-- Bottom prompt bar -->
	<div class="canvas-bottom">
		{#if errorMessage}
			<div class="error-banner">{errorMessage}</div>
		{/if}
		<div class="prompt-wrapper">
			<div class="grow-wrap" bind:this={promptWrapDiv}>
				<textarea
					bind:this={promptTextArea}
					placeholder="Beskriv hva du vil gjøre med dokumentet…"
					bind:value={prompt}
					onkeydown={onKeydown}
					rows={1}
				></textarea>
			</div>
			<div class="prompt-actions">
				<button
					class="icon-button input-action-button"
					class:active={webSearchEnabled}
					onclick={() => (webSearchEnabled = !webSearchEnabled)}
					title={webSearchEnabled ? "Websøk aktivert" : "Websøk deaktivert"}
					type="button"
				>
					<span class="material-symbols-outlined">travel_explore</span>
				</button>
				<div class="prompt-submit">
					{#if isLoading}
						<button class="icon-button send-button" disabled title="Sender...">
							<TypingDots />
						</button>
					{:else}
						<button class="icon-button filled send-button" onclick={submitPrompt} disabled={!prompt.trim()} title="Send (Enter)">
							<span class="material-symbols-outlined">arrow_upward</span>
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.canvas-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background-color: #f0f0ef;
	}

	/* Top bar */
	.canvas-topbar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
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

	/* Scrollable canvas area */
	.canvas-body {
		flex: 1;
		overflow-y: auto;
		padding: 2rem 1.5rem;
		display: flex;
		justify-content: center;
	}

	/* Paper card */
	.canvas-paper {
		background: white;
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10), 0 0 0 1px rgba(0, 0, 0, 0.04);
		padding: 3rem 4rem;
		width: 100%;
		max-width: 52rem;
		box-sizing: border-box;
		align-self: flex-start;
	}

	.empty-hint {
		color: #aaa;
		font-style: italic;
	}

	.document-editor {
		width: 100%;
		min-height: 60vh;
		border: none;
		outline: none;
		resize: none;
		font: inherit;
		line-height: 1.6;
		background: transparent;
		box-sizing: border-box;
	}

	/* Bottom prompt bar */
	.canvas-bottom {
		flex-shrink: 0;
		padding: 0.75rem 1.5rem;
		background-color: #f0f0ef;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.prompt-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-primary);
		border-radius: 24px;
		background: white;
		transition: box-shadow 0.2s;
	}

	.prompt-wrapper:focus-within {
		border-color: var(--color-primary-80);
		box-shadow: 0 0 0 2px var(--color-primary-20);
	}

	.grow-wrap {
		flex: 1;
		display: grid;
		padding: 0.5rem 0;
	}

	.grow-wrap::after {
		content: attr(data-replicated-value) " ";
		white-space: pre-wrap;
		visibility: hidden;
		max-height: 8rem;
	}

	.grow-wrap > textarea,
	.grow-wrap::after {
		font: inherit;
		grid-area: 1 / 1 / 2 / 2;
		border: none;
		outline: none;
		resize: none;
		background: transparent;
		max-height: 8rem;
		overflow-y: auto;
	}

	.grow-wrap > textarea::placeholder {
		color: var(--color-primary-70);
	}

	.prompt-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.input-action-button {
		padding: 0.5rem 0.375rem;
	}

	.input-action-button.active {
		color: var(--color-primary);
		background-color: var(--color-primary-20);
		border-radius: 50%;
	}

	.send-button {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		justify-content: center;
		transition: background-color 0.2s;
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
