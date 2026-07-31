<script lang="ts">
	import { onMount } from "svelte"
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

	async function loadFiles() {
		files = await api.getFiles(store.storeId)
	}

	async function removeFile(userId: string) {
		await api.removeFile(store.storeId, userId)
		loadFiles()
	}

	onMount(() => {
		loadFiles()
	})
</script>

<main class="rag-card">
	{#if store._embedded.access.upload}
		<h3 class="rag-section-title">Last opp fil</h3>
		<FileUpload storeId={store.storeId} onFileUploaded={() => loadFiles()} />
	{/if}

	<h3 class="rag-section-title">Filer</h3>
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
					<td>{file.status}</td>
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
</style>
