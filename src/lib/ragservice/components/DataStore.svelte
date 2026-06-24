<script lang="ts">
	import type { StoreConfig, StoreResponse } from "$lib/ragservice/types";
	import FileList from "../components/FileList.svelte";
	import DataStoreTextSearch from "../components/DataStoreTextSearch.svelte";
	import DataStoreAccess from "../components/DataStoreAccess.svelte";
	import DataStoreChunks from "../components/DataStoreChunks.svelte";
	import { RagServiceApi } from "../adapters/ragserviceApi";
	import { goto } from "$app/navigation";
	import DataStoreCreate from "./DataStoreCreate.svelte";

	type Props = {
		stores: StoreConfig[];
	};
	let { stores }: Props = $props();

	let selectedStoreId: string = $state("");
	let store: StoreResponse | null = $state(null);
	let activeTab: string = $state("search");

	let createNew: boolean = $state(false);

	const api = new RagServiceApi();

	async function loadStore(storeId: string) {
		if (!storeId) return;
		store = await api.getStore(storeId, true);
	}

	async function deleteStore() {
		if (!store) return;
		const doDelete = confirm("Er du HELT sikker på at du vil slette ?");
		if (doDelete) {
			const success = await api.deleteStore(store.storeId);
			if (success) await goto("/");
		}
	}

	$effect(() => {
		/*
		if(stores.length <= 0){
			createNew = true
		}*/

		if (!selectedStoreId && stores.length > 0) {
			selectedStoreId = stores[0]!.storeId;
		} else {
			loadStore(selectedStoreId);
		}
	});
</script>

<main>
	{#if createNew}
		<DataStoreCreate
			onDone={(newStore: StoreConfig | null) => {
				if (newStore) {
					stores.push(newStore);
					selectedStoreId = newStore.storeId;
				}
				createNew = false;
			}}
		></DataStoreCreate>
	{:else}
		<div class="store-header">
			<select bind:value={selectedStoreId}>
				{#each stores as s}
					<option value={s.storeId}>{s.name}</option>
				{/each}
			</select>
			<button onclick={() => (createNew = true)}>
				<span class="material-symbols-outlined">add</span>Lag nytt bibliotek
			</button>

			{#if store}
				<button
					disabled={!store._embedded.access.admin}
					class="filled danger"
					onclick={() => deleteStore()}
				>
					<span class="material-symbols-outlined">delete</span>Slett bibliotek
				</button>
			{/if}
		</div>

		{#if store}
			<table>
				<tbody>
					<tr><td>Beskrivelse</td><td>:</td><td>{store.description}</td></tr>
					<tr><td>Method</td><td>:</td><td>{store.embeddingMethod}</td></tr>
					<tr><td>Dimensions</td><td>:</td><td>{store.dimensions}</td></tr>
					<tr><td>Opprettet av</td><td>:</td><td>{store.createdBy.name}</td></tr
					>
				</tbody>
			</table>

			<div class="tabrow">
				{#if store._embedded.access.search}
					<button
						disabled={activeTab === "search"}
						class="tabButton"
						onclick={() => {
							activeTab = "search";
						}}>Søk</button
					>
				{/if}
				{#if store._embedded.access.upload}
					<button
						disabled={activeTab === "files"}
						class="tabButton"
						onclick={() => {
							activeTab = "files";
						}}>Filer</button
					>
					<button
						disabled={activeTab === "chunks"}
						class="tabButton"
						onclick={() => {
							activeTab = "chunks";
						}}>Legg til chunks</button
					>
				{/if}

				{#if store._embedded.access.admin}
					<button
						disabled={activeTab === "access"}
						class="tabButton"
						onclick={() => {
							activeTab = "access";
						}}>Tilganger</button
					>
				{/if}
			</div>

			<div>
				{#if activeTab === "files"}
					<FileList {store} />
				{:else if activeTab === "search"}
					<DataStoreTextSearch {store} />
				{:else if activeTab === "access"}
					<DataStoreAccess {store} />
				{:else if activeTab === "chunks"}
					<DataStoreChunks {store} />
				{/if}
			</div>
		{/if}
	{/if}
</main>

<style>
	div.store-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}

	select {
		font-size: 1.1rem;
		padding: 4px 8px;
	}

	button.deletebutton {
		/*background-color: lightsalmon;*/
		cursor: pointer;
	}

	td {
		text-align: left;
	}

	button.tabButton {
		border: 1px solid #888887;
		font-size: 14px;
		border-top-left-radius: 5px;
		border-top-right-radius: 5px;
		/*background-color: #c9c189; */
		color: #888887;
		cursor: pointer;
	}

	button.tabButton:disabled,
	button.tabButton[disabled] {
		border-top: 1px solid #888887;
		font-size: 14px;
		border-top-left-radius: 5px;
		border-top-right-radius: 5px;
		border-bottom: 0px solid #ffffff;
		background-color: #ffffff;
		color: #000000;
	}

	div.tabrow {
		display: flex;
		gap: 4px;
		padding-top: 5px;
		padding-bottom: 0px;
		border-bottom: 1px solid #888887;
	}
</style>
