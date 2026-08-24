<script lang="ts">
	import { goto } from "$app/navigation"
	import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte"
	import type { StoreConfig, StoreResponse } from "$lib/ragservice/types"
	import { RagServiceApi } from "../adapters/ragserviceApi"
	import DataStoreAccess from "../components/DataStoreAccess.svelte"
	import DataStoreChunks from "../components/DataStoreChunks.svelte"
	import DataStoreSettings from "../components/DataStoreSettings.svelte"
	import DataStoreTextSearch from "../components/DataStoreTextSearch.svelte"
	import FileList from "../components/FileList.svelte"
	import "./ragservice-shared.css"
	import DataStoreCreate from "./DataStoreCreate.svelte"

	type Props = {
		stores: StoreConfig[]
	}
	let { stores }: Props = $props()

	let selectedStoreId: string = $state("")
	let store: StoreResponse | null = $state(null)
	let activeTab: string = $state("view")

	let createNew: boolean = $state(false)

	const api = new RagServiceApi()

	async function loadStore(storeId: string) {
		if (!storeId) return
		store = null
		store = await api.getStore(storeId, true)
		if (store) {
			const access = store._embedded.access
			if (access.search) activeTab = "search"
			else if (access.upload) activeTab = "files"
			else if (access.admin) activeTab = "access"
			else activeTab = "view"
		}
	}

	// Deliberately doesn't reuse loadStore: this re-fetches the *same* store after a save (from
	// Innstillinger or the Søk tab's "lagre som standard"), so it must not null out `store` first
	// (that would tear down and remount the active tab's component, wiping its own local state -
	// e.g. the Søk tab's search text/results) or recompute activeTab (that would bounce the user
	// to a different tab based on access flags every time they save).
	async function refreshStore() {
		if (!store) return
		const updated = await api.getStore(store.storeId, true)
		if (updated) store = updated
	}

	let showDeleteConfirm = $state(false)
	let deleteError: string | null = $state(null)

	async function deleteStore() {
		if (!store) return
		deleteError = null
		const success = await api.deleteStore(store.storeId)
		if (success) {
			await goto("/")
		} else {
			deleteError = "Kunne ikke slette biblioteket. Prøv igjen."
		}
	}

	$effect(() => {
		if (!selectedStoreId && stores.length > 0) {
			const first = stores[0]
			if (first) selectedStoreId = first.storeId
		} else {
			loadStore(selectedStoreId)
		}
	})
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
			{#if stores.length > 0}
				<select bind:value={selectedStoreId}>
					{#each stores as s}
						<option value={s.storeId}>{s.name}</option>
					{/each}
				</select>
			{/if}
			<button onclick={() => (createNew = true)}>
				<span class="material-symbols-outlined">add</span>Lag nytt bibliotek
			</button>

			{#if store}
				<button
					disabled={!store._embedded.access.admin}
					class="filled danger"
					onclick={() => (showDeleteConfirm = true)}
				>
					<span class="material-symbols-outlined">delete</span>Slett bibliotek
				</button>
			{/if}
		</div>

		<ConfirmDeleteDialog
			bind:show={showDeleteConfirm}
			message={`Er du sikker på at du vil slette "${store?.name ?? ""}"?`}
			subtext="Biblioteket og alt innhold i det slettes permanent og kan ikke gjenopprettes."
			onConfirm={deleteStore}
		/>
		{#if deleteError}
			<p class="delete-error">{deleteError}</p>
		{/if}

		{#if store}
			<div class="rag-card store-info">
				<div class="rag-simple-field">
					<span class="rag-field-label">Beskrivelse</span>
					<span>{store.description}</span>
				</div>
				<!--div class="rag-simple-field">
					<span class="rag-field-label">Method</span>
					<span>{store.embeddingMethod}</span>
				</div-->
				<div class="rag-simple-field">
					<span class="rag-field-label">Dimensions</span>
					<span>{store.dimensions}</span>
				</div>
				<div class="rag-simple-field">
					<span class="rag-field-label">Opprettet av</span>
					<span>{store.createdBy.name}</span>
				</div>
			</div>

			<div class="rag-tabs">
				{#if store._embedded.access.search}
					<button
						class="rag-tab-button"
						disabled={activeTab === "search"}
						onclick={() => {
							activeTab = "search";
						}}>Søk</button
					>
				{/if}
				{#if store._embedded.access.upload}
					<button
						class="rag-tab-button"
						disabled={activeTab === "files"}
						onclick={() => {
							activeTab = "files";
						}}>Filer</button
					>
					<button
						class="rag-tab-button"
						disabled={activeTab === "chunks"}
						onclick={() => {
							activeTab = "chunks";
						}}>Legg til chunks</button
					>
				{/if}

				{#if store._embedded.access.admin}
					<button
						class="rag-tab-button"
						disabled={activeTab === "access"}
						onclick={() => {
							activeTab = "access";
						}}>Tilganger</button
					>
					<button
						class="rag-tab-button"
						disabled={activeTab === "settings"}
						onclick={() => {
							activeTab = "settings";
						}}>Innstillinger</button
					>
				{/if}
			</div>

			<div class="tab-content">
				{#if activeTab === "files"}
					<FileList {store} />
				{:else if activeTab === "search"}
					<DataStoreTextSearch {store} onSaved={refreshStore} />
				{:else if activeTab === "access"}
					<DataStoreAccess {store} />
				{:else if activeTab === "chunks"}
					<DataStoreChunks {store} />
				{:else if activeTab === "settings"}
					<DataStoreSettings {store} onSaved={refreshStore} />
				{:else if activeTab === "view"}
					<p class="rag-muted">Du har kun tilgang til å liste opp dette biblioteket.</p>
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
		margin-bottom: 16px;
	}

	select {
		font-family: var(--font-family);
		font-size: 1rem;
		padding: 6px 10px;
		border: 1px solid var(--color-primary-30);
		border-radius: 4px;
	}

	div.store-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	div.store-info .rag-simple-field {
		grid-template-columns: 140px 1fr;
	}

	div.tab-content {
		margin-top: 16px;
	}

	p.delete-error {
		color: var(--color-danger);
		margin: 0 0 16px;
	}
</style>
