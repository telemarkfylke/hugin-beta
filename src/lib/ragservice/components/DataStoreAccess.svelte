<script lang="ts">
	import { onMount } from "svelte"
	import { RagServiceApi } from "../adapters/ragserviceApi"
	import type { AccessFlat, AccessType, GraphGroup, GraphUser, StoreResponse, UnrestrictedAccess } from "../types"
	import "./ragservice-shared.css"
	import { flattenAccesses } from "../utils"

	type Props = {
		store: StoreResponse
	}
	let { store }: Props = $props()

	let userAccesses: AccessFlat[] = $state([])
	let unrestricted: UnrestrictedAccess | null = $state(null)
	const api = new RagServiceApi()

	let newAccess: AccessFlat = $state({
		id: "",
		type: "user",
		view: false,
		search: false,
		upload: false,
		admin: false
	})

	type EntitySuggestion = { id: string; label: string }
	let searchInput: string = $state("")
	let suggestions: EntitySuggestion[] = $state([])
	let searchTimer: ReturnType<typeof setTimeout> | null = null

	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer)
		if (searchInput.length < 2) {
			suggestions = []
			return
		}
		searchTimer = setTimeout(async () => {
			if (newAccess.type === "user") {
				const results = await api.searchUsers(searchInput)
				suggestions = results.map((u: GraphUser) => ({ id: u.id, label: `${u.displayName} (${u.userPrincipalName})` }))
			} else {
				const results = await api.searchGroups(searchInput)
				suggestions = results.map((g: GraphGroup) => ({ id: g.id, label: g.displayName }))
			}
		}, 300)
	}

	function selectSuggestion(s: EntitySuggestion) {
		newAccess.id = s.id
		newAccess.name = s.label
		searchInput = s.label
		suggestions = []
	}

	const TYPE_LABELS: Record<AccessType, string> = {
		user: "Bruker",
		group: "Gruppe",
		role: "Rolle"
	}

	function onTypeChange() {
		newAccess.id = ""
		searchInput = ""
		suggestions = []
	}

	async function setAccess(access: AccessFlat) {
		await api.setAccess(store.storeId, access.type, access.id, {
			view: access.view,
			search: access.search,
			upload: access.upload,
			admin: access.admin,
			name: access.name
		})
		loadAccess()
	}

	async function loadAccess() {
		const access = await api.getAccess(store.storeId)
		userAccesses = [...flattenAccesses(access.users || {}, "user"), ...flattenAccesses(access.groups || {}, "group")]
		unrestricted = access.unrestricted
	}

	/*
	async function loadUnrestricted() {
		unrestricted = await api.getUnrestrictedAccess(store.storeId)
	}*/

	async function updateUnrestricted(patch: Partial<UnrestrictedAccess>) {
		const current = unrestricted ?? { view: false, search: false }
		const updated = { ...current, ...patch }
		await api.setUnrestrictedAccess(store.storeId, updated)
		unrestricted = updated
	}

	async function removeUnrestricted() {
		await api.deleteUnrestrictedAccess(store.storeId)
		unrestricted = null
	}

	async function removeAccess(id: string, type: AccessType) {
		await api.removeAccess(store.storeId, type, id)
		loadAccess()
	}

	onMount(() => {
		loadAccess()
		//loadUnrestricted()
	})
</script>

<main class="rag-card">
	<h3 class="rag-section-title">Åpen tilgang</h3>
	<div class="rag-field-grid">
		<label class="rag-field-label">
			<input
				type="checkbox"
				checked={unrestricted?.view ?? false}
				onchange={(e) => updateUnrestricted({ view: (e.target as HTMLInputElement).checked })}
				disabled={!store._embedded.access.admin}
			/>
			Alle kan se
		</label>
		<label class="rag-field-label">
			<input
				type="checkbox"
				checked={unrestricted?.search ?? false}
				onchange={(e) => updateUnrestricted({ search: (e.target as HTMLInputElement).checked })}
				disabled={!store._embedded.access.admin}
			/>
			Alle kan søke
		</label>
		{#if unrestricted}
			<div>
				<button onclick={removeUnrestricted} disabled={!store._embedded.access.admin}> Fjern åpen tilgang </button>
			</div>
		{/if}
	</div>

	<h3 class="rag-section-title">Legg til tilgang</h3>
	<div class="rag-field-grid">
		<div class="rag-simple-field">
			<span class="rag-field-label">Type</span>
			<select bind:value={newAccess.type} onchange={onTypeChange}>
				<option value={"user"}>Bruker</option>
				<option value={"group"}>Gruppe</option>
			</select>
		</div>
		<div class="rag-simple-field">
			<span class="rag-field-label">Søk</span>
			<div class="combobox-cell">
				<input
					type="text"
					bind:value={searchInput}
					oninput={onSearchInput}
					disabled={!store._embedded.access.admin}
					placeholder={newAccess.type === "user" ? "Søk etter bruker..." : "Søk etter gruppe..."}
				/>
				{#if suggestions.length > 0}
					<ul class="suggestions">
						{#each suggestions as s}
							<li>
								<button type="button" onclick={() => selectSuggestion(s)}>{s.label}</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
		{#if newAccess.id}
			<div class="rag-simple-field">
				<span class="rag-field-label">Valgt id</span>
				<span class="selected-id">{newAccess.id}</span>
			</div>
		{/if}
		<label class="rag-field-label">
			<input type="checkbox" bind:checked={newAccess.view} disabled={!store._embedded.access.admin} />
			Kan se
		</label>
		<label class="rag-field-label">
			<input type="checkbox" bind:checked={newAccess.search} disabled={!store._embedded.access.admin} />
			Kan søke
		</label>
		<label class="rag-field-label">
			<input type="checkbox" bind:checked={newAccess.upload} disabled={!store._embedded.access.admin} />
			Kan laste opp
		</label>
		<label class="rag-field-label">
			<input type="checkbox" bind:checked={newAccess.admin} disabled={!store._embedded.access.admin} />
			Kan administrere
		</label>
		<div>
			<button class="filled" onclick={() => setAccess(newAccess)} disabled={!store._embedded.access.admin}>Sett tilganger</button>
		</div>
	</div>

	<h3 class="rag-section-title">Eksisterende tilganger</h3>
	<table class="rag-table access-list">
		<thead>
			<tr>
				<th>Type</th>
				<th>Navn</th>
				<th>Se</th>
				<th>Søk</th>
				<th>Last opp</th>
				<th>Admin</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each userAccesses as accessRow}
				<tr>
					<td>{TYPE_LABELS[accessRow.type]}</td>
					<td title={accessRow.id}>{accessRow.name ?? accessRow.id}</td>
					<td>
						<input
							type="checkbox"
							bind:checked={accessRow.view}
							onchange={() => setAccess(accessRow)}
							disabled={!store._embedded.access.admin}
						/>
					</td>
					<td>
						<input
							type="checkbox"
							bind:checked={accessRow.search}
							onchange={() => setAccess(accessRow)}
							disabled={!store._embedded.access.admin}
						/>
					</td>
					<td>
						<input
							type="checkbox"
							bind:checked={accessRow.upload}
							onchange={() => setAccess(accessRow)}
							disabled={!store._embedded.access.admin}
						/>
					</td>
					<td>
						<input
							type="checkbox"
							bind:checked={accessRow.admin}
							onchange={() => setAccess(accessRow)}
							disabled={!store._embedded.access.admin}
						/>
					</td>
					<td>
						<button class="danger" onclick={() => removeAccess(accessRow.id, accessRow.type)} disabled={!store._embedded.access.admin}
							>Slett</button
						>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</main>

<style>
	table.access-list td:nth-child(2),
	table.access-list th:nth-child(2) {
		min-width: 200px;
		white-space: nowrap;
	}

	div.combobox-cell {
		position: relative;
	}

	div.combobox-cell input {
		width: 100%;
		box-sizing: border-box;
		font-family: var(--font-family);
		padding: 4px 6px;
		border: 1px solid var(--color-primary-30);
		border-radius: 4px;
	}

	ul.suggestions {
		position: absolute;
		z-index: 10;
		background: white;
		border: 1px solid var(--color-primary-30);
		border-radius: 4px;
		margin: 4px 0 0;
		padding: 0;
		list-style: none;
		min-width: 300px;
		max-height: 200px;
		overflow-y: auto;
	}

	ul.suggestions li button {
		display: block;
		width: 100%;
		height: auto;
		text-align: left;
		padding: 6px 8px;
		background: none;
		border: none;
		border-radius: 0;
		cursor: pointer;
		white-space: nowrap;
		color: inherit;
	}

	ul.suggestions li button:hover {
		background-color: var(--color-primary-10);
	}

	span.selected-id {
		font-size: 0.85em;
		color: #555;
		font-family: monospace;
	}

	button.danger {
		color: var(--color-danger);
		border-color: var(--color-danger);
	}
</style>
