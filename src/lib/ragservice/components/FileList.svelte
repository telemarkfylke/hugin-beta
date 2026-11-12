<script lang="ts">
	import { onDestroy, onMount } from "svelte"
	import { RagServiceApi } from "../adapters/ragserviceApi"
	import { approximatePages, FILE_USAGE_CHOICES, type FileUsageChoice, fileUsage, isDone, isFileIndexed, isOriginalMissing, usageChoice, usageChoiceBlocker } from "../file-usage"
	import type { StoreResponse, VectorStoreFile } from "../types"
	import "./ragservice-shared.css"
	import FileUpload from "./FileUpload.svelte"

	type Props = {
		store: StoreResponse
	}
	let { store }: Props = $props()
	const api = new RagServiceApi()
	let files: VectorStoreFile[] = $state([])
	let pollInterval: ReturnType<typeof setInterval> | undefined
	// Per file: a call in flight (disables that row's controls), and the last error or notice to show under it
	let busy: Record<string, boolean> = $state({})
	let messages: Record<string, { text: string; isError: boolean }> = $state({})

	const canUpload = $derived(store._embedded.access.upload)
	const hasPendingFiles = () => files.some((f) => !isDone(f))

	async function loadFiles() {
		files = await api.getFiles(store.storeId)

		if (hasPendingFiles()) {
			ensurePolling()
		} else if (pollInterval) {
			clearInterval(pollInterval)
			pollInterval = undefined
		}
	}

	function ensurePolling() {
		if (!pollInterval) {
			pollInterval = setInterval(loadFiles, 10_000)
		}
	}

	async function removeFile(fileId: string) {
		await api.removeFile(store.storeId, fileId)
		loadFiles()
	}

	function setMessage(fileId: string, text: string | null, isError = true) {
		if (text === null) {
			const { [fileId]: _, ...rest } = messages
			messages = rest
		} else {
			messages = { ...messages, [fileId]: { text, isError } }
		}
	}

	async function runForFile(fileId: string, action: () => Promise<void>) {
		busy = { ...busy, [fileId]: true }
		setMessage(fileId, null)
		try {
			await action()
		} catch (error) {
			setMessage(fileId, error instanceof Error ? error.message : "Noe gikk galt")
		} finally {
			busy = { ...busy, [fileId]: false }
			await loadFiles()
		}
	}

	function changeUsage(file: VectorStoreFile, choice: FileUsageChoice) {
		const option = FILE_USAGE_CHOICES.find((c) => c.choice === choice)
		if (!option) return
		runForFile(file.id, async () => {
			await api.setFileUsage(store.storeId, file.id, option.usage)
		})
	}

	function indexFile(file: VectorStoreFile) {
		runForFile(file.id, async () => {
			const indexing = api.indexFile(store.storeId, file.id)
			// Ragservice marks the file busy right away - show that, and let polling follow the progress
			setTimeout(loadFiles, 1500)
			const outcome = await indexing
			if (outcome === "pending") {
				setMessage(file.id, "Indekseringen tar tid og fortsetter i bakgrunnen. Følg med på statusen.", false)
			}
		})
	}

	function removeIndex(file: VectorStoreFile) {
		const confirmed = confirm(
			`Fjerne søkeindeksen for «${file.name}»?\n\nFilen blir ikke lenger søkbar, men beholdes. Manuelle endringer i filens chunks går tapt. Du kan indeksere den på nytt senere.`
		)
		if (!confirmed) return
		runForFile(file.id, async () => {
			await api.removeFileIndex(store.storeId, file.id)
		})
	}

	// progress kommer fra backend som f.eks. "350 / 362" (chunks behandlet / totalt).
	// Regner ut prosent for progressbaren, men faller tilbake til bare å vise raw-teksten
	// hvis formatet skulle avvike.
	function progressPercent(progress: string | undefined): number | null {
		if (!progress) return null
		const match = progress.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/)
		if (!match) return null
		const [, done, total] = match
		const totalNum = Number(total)
		if (totalNum <= 0) return null
		return Math.min(100, Math.round((Number(done) / totalNum) * 100))
	}

	onMount(() => {
		loadFiles()
	})

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval)
	})
</script>

<main class="rag-card">
	{#if canUpload}
		<h3 class="rag-section-title">Last opp fil</h3>
		<FileUpload storeId={store.storeId} onFileUploaded={() => loadFiles()} />
	{/if}

	<h3 class="rag-section-title files-title">
		Filer
		<button class="icon-button" onclick={loadFiles} title="Oppdater filstatus">
			<span class="material-symbols-outlined">refresh</span>
		</button>
	</h3>
	<p class="usage-help">
		<b>Bruk</b> bestemmer hva botene får av filen: <b>Fil-innhold</b> legger ved hele filen, <b>Søk</b> gir utdrag som passer spørsmålet.
		Søk krever at filen er indeksert først.
	</p>
	<div class="table-scroll">
		<table class="rag-table">
			<thead>
				<tr>
					<th>Status</th>
					<th>Navn</th>
					<th>Størrelse</th>
					<th>Bruk</th>
					<th>Søkeindeks</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each files as file (file.id)}
					{@const done = isDone(file)}
					{@const indexed = isFileIndexed(file)}
					{@const rowBusy = busy[file.id] ?? false}
					{@const message = messages[file.id]}
					<tr>
						<td>
							<span class="status-badge" class:status-done={done}>{done ? "Ferdig" : file.status}</span>
							{#if file.progress && !done}
								{@const percent = progressPercent(file.progress)}
								<div class="file-progress" title={file.progress}>
									{#if percent !== null}
										<div class="file-progress-bar">
											<div class="file-progress-bar-fill" style="width: {percent}%"></div>
										</div>
									{/if}
									<span class="file-progress-label">{file.progress}</span>
								</div>
							{/if}
						</td>
						<td>
							<span class="file-name">{file.name}</span>
							{#if isOriginalMissing(file)}
								<span class="chip chip-warn" title="Lastet opp før filene ble lagret. Den kan bare søkes i. Last opp filen på nytt for å bruke hele innholdet.">
									Original mangler
								</span>
							{/if}
						</td>
						<td class="size">
							{#if file.text}
								ca. {approximatePages(file.text.characters)} {approximatePages(file.text.characters) === 1 ? "side" : "sider"}
							{:else}
								–
							{/if}
						</td>
						<td>
							<select
								class="usage-select"
								aria-label="Bruk av {file.name}"
								value={usageChoice(fileUsage(file))}
								disabled={!canUpload || !done || rowBusy}
								onchange={(e) => changeUsage(file, e.currentTarget.value as FileUsageChoice)}
							>
								{#each FILE_USAGE_CHOICES as option (option.choice)}
									{@const blocker = usageChoiceBlocker(file, option.usage)}
									<option value={option.choice} disabled={blocker !== null}>
										{option.label}{blocker ? ` (${blocker.toLowerCase()})` : ""}
									</option>
								{/each}
							</select>
						</td>
						<td class="index-cell">
							{#if indexed}
								<span class="chip chip-ok">Indeksert</span>
								{#if canUpload && !isOriginalMissing(file)}
									<button class="text-button" onclick={() => removeIndex(file)} disabled={!done || rowBusy}>Fjern</button>
								{/if}
							{:else if isOriginalMissing(file)}
								–
							{:else if canUpload}
								<button onclick={() => indexFile(file)} disabled={!done || rowBusy}>
									{rowBusy ? "Indekserer..." : "Indekser"}
								</button>
							{:else}
								<span class="muted">Ikke indeksert</span>
							{/if}
						</td>
						<td>
							<button class="danger" onclick={() => removeFile(file.id)} disabled={!store._embedded.access.admin || rowBusy}>Slett</button>
						</td>
					</tr>
					{#if message}
						<tr class="message-row">
							<td colspan="6" class:error={message.isError}>{message.text}</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</main>

<style>
	button.danger {
		color: var(--color-danger);
		border-color: var(--color-danger);
	}

	.files-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.files-title button.icon-button {
		height: 1.6rem;
		width: 1.6rem;
		padding: 0;
		justify-content: center;
	}

	p.usage-help {
		font-size: 0.85rem;
		color: var(--color-primary-80);
		margin: 0 0 8px;
		max-width: 70ch;
	}

	div.table-scroll {
		overflow-x: auto;
	}

	.file-progress {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 2px;
	}

	.file-progress-bar {
		width: 80px;
		height: 4px;
		border-radius: 2px;
		background-color: var(--color-primary-10);
		overflow: hidden;
	}

	.file-progress-bar-fill {
		height: 100%;
		background-color: var(--color-primary);
		transition: width 0.2s ease;
	}

	.file-progress-label {
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: var(--color-primary-70);
	}

	span.status-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		background-color: var(--color-primary-10);
		color: var(--color-primary-80);
	}

	span.status-badge.status-done {
		background-color: var(--color-secondary-20);
		color: var(--color-primary);
	}

	span.chip {
		display: inline-block;
		padding: 1px 6px;
		border-radius: 4px;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	span.chip-ok {
		background-color: var(--color-secondary-20);
		color: var(--color-primary);
	}

	span.chip-warn {
		margin-left: 6px;
		background-color: var(--color-primary-10);
		color: var(--color-danger);
		cursor: help;
	}

	td.size {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	td.index-cell {
		white-space: nowrap;
	}

	select.usage-select {
		font-family: var(--font-family);
		padding: 4px 6px;
		border: 1px solid var(--color-primary-30);
		border-radius: 4px;
	}

	button.text-button {
		border: none;
		background: none;
		padding: 0 4px;
		text-decoration: underline;
		color: var(--color-primary-80);
		cursor: pointer;
	}

	span.muted {
		color: var(--color-primary-70);
	}

	tr.message-row td {
		font-size: 0.85rem;
		color: var(--color-primary-80);
		padding-top: 0;
	}

	tr.message-row td.error {
		color: var(--color-danger);
	}
</style>
