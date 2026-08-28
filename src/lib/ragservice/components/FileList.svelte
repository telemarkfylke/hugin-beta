<script lang="ts">
	import { onDestroy, onMount } from "svelte"
	import { RagServiceApi } from "../adapters/ragserviceApi"
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

	const hasPendingFiles = () => files.some((f) => f.status.toLowerCase() !== "done")

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

	async function removeFile(userId: string) {
		await api.removeFile(store.storeId, userId)
		loadFiles()
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

	// status is a free-form string from ragservice - "done" (checked case-insensitively) is the
	// only value we can rely on, so that's the only one we badge/translate rather than guessing
	// at other literal status strings.
	function isDone(status: string): boolean {
		return status.toLowerCase() === "done"
	}

	onMount(() => {
		loadFiles()
	})

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval)
	})
</script>

<main class="rag-card">
	{#if store._embedded.access.upload}
		<h3 class="rag-section-title">Last opp fil</h3>
		<FileUpload storeId={store.storeId} onFileUploaded={() => loadFiles()} />
	{/if}

	<h3 class="rag-section-title files-title">
		Filer
		<button class="icon-button" onclick={loadFiles} title="Oppdater filstatus">
			<span class="material-symbols-outlined">refresh</span>
		</button>
	</h3>
	<table class="rag-table">
		<thead>
			<tr>
				<th>Status</th>
				<th>Navn</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each files as file}
				<tr>
					<td>
						<span class="status-badge" class:status-done={isDone(file.status)}>{isDone(file.status) ? "Ferdig" : file.status}</span>
						{#if file.progress && !isDone(file.status)}
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
					<td>{file.name}</td>
					<td>
						<button class="danger" onclick={() => removeFile(file.id)} disabled={!store._embedded.access.admin}>Slett</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
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
</style>
