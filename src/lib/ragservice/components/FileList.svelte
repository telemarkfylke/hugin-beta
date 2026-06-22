<script lang="ts">
  import { RagServiceApi } from "../adapters/ragserviceApi";
	import type { StoreResponse, VectorStoreFile } from "../types";

    import FileUpload from "./FileUpload.svelte";
    import { onMount } from "svelte";

	type Props = {
		store: StoreResponse;
	};
	let { store }: Props = $props();
	const api = new RagServiceApi();
	let files: VectorStoreFile[] = $state([]);

	async function loadFiles() {
		files = await api.getFiles(store.storeId);
	}

	async function removeFile(userId: string){
		await api.removeFile(store.storeId, userId)
		loadFiles()
	}

	onMount(() => {
		loadFiles();
	});

</script>

<main>

	{#if store._embedded.access.upload}
		<div>
			<FileUpload onFileUploaded={() => loadFiles()}></FileUpload>
		</div>
		<hr>
	{/if}

	<table>
		<thead>
			<tr>
				<!--th>Id</th-->
				<th>Status</th>
				<th>Navn</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each files as file}
				<tr>
					<!--td>{file.id}</td-->
					<td>{file.status}</td>
					<td>{file.name}</td>
					<td><button onclick={() => removeFile(file.id)}  disabled= {!store._embedded.access.admin} >SLETT</button></td>
				</tr>
			{/each}
		</tbody>
	</table>

</main>

<style>
	td,
	th {
		text-align: left;
		border: 1px solid darkgray;
	}
</style>
