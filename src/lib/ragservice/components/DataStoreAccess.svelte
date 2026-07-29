<script lang="ts">
	import { onMount } from "svelte"
	import { RagServiceApi } from "../adapters/ragserviceApi"
	import type { AccessFlat, AccessType, GraphGroup, GraphUser, StoreResponse, UnrestrictedAccess } from "../types"
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

	/*disabled= {store._embedded.access.admin)} */
</script>

<main>
	<table>
		<tbody>
			<tr
				><td>Type</td><td>
					<select bind:value={newAccess.type} onchange={onTypeChange}>
						<option value={"user"}>User</option>
						<option value={"group"}>Group</option>
					</select>
				</td></tr
			>
			<tr>
				<td>Søk</td>
				<td class="combobox-cell">
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
				</td>
			</tr>
			{#if newAccess.id}
			<tr><td>Valgt id</td><td class="selected-id">{newAccess.id}</td></tr>
			{/if}
			<tr
				><td>Kan se</td><td
					><input
						type="checkbox"
						bind:checked={newAccess.view}
						disabled={!store._embedded.access.admin}
					/></td
				></tr
			>

			<tr
				><td>Kan søke</td><td
					><input
						type="checkbox"
						bind:checked={newAccess.search}
						disabled={!store._embedded.access.admin}
					/></td
				></tr
			>
			<tr
				><td>Kan Laste opp</td><td
					><input
						type="checkbox"
						bind:checked={newAccess.upload}
						disabled={!store._embedded.access.admin}
					/></td
				></tr
			>
			<tr
				><td>Kan administrere</td><td
					><input
						type="checkbox"
						bind:checked={newAccess.admin}
						disabled={!store._embedded.access.admin}
					/></td
				></tr
			>
			<tr
				><td colspan="2"
					><button
						onclick={() => setAccess(newAccess)}
						disabled={!store._embedded.access.admin}>Sett Tilganger</button
					></td
				></tr
			>
		</tbody>
	</table>
	<hr />
	<h4>Åpen tilgang</h4>
	<table>
		<tbody>
			<tr>
				<td>Alle kan se</td>
				<td>
					<input
						type="checkbox"
						checked={unrestricted?.view ?? false}
						onchange={(e) => updateUnrestricted({ view: (e.target as HTMLInputElement).checked })}
						disabled={!store._embedded.access.admin}
					/>
				</td>
			</tr>
			<tr>
				<td>Alle kan søke</td>
				<td>
					<input
						type="checkbox"
						checked={unrestricted?.search ?? false}
						onchange={(e) => updateUnrestricted({ search: (e.target as HTMLInputElement).checked })}
						disabled={!store._embedded.access.admin}
					/>
				</td>
			</tr>
			{#if unrestricted}
				<tr>
					<td colspan="2">
						<button onclick={removeUnrestricted} disabled={!store._embedded.access.admin}>
							Fjern åpen tilgang
						</button>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
	<hr />
	<table class="access-list">
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
					<td>{accessRow.type}</td>
					<td title={accessRow.id}>{accessRow.name ?? accessRow.id}</td>
					<td
						><input
							type="checkbox"
							bind:checked={accessRow.view}
							onchange={() => setAccess(accessRow)}
							disabled={!store._embedded.access.admin}
						/></td
					>
					<td
						><input
							type="checkbox"
							bind:checked={accessRow.search}
							onchange={() => setAccess(accessRow)}
							disabled={!store._embedded.access.admin}
						/></td
					>
					<td
						><input
							type="checkbox"
							bind:checked={accessRow.upload}
							onchange={() => setAccess(accessRow)}
							disabled={!store._embedded.access.admin}
						/></td
					>
					<td
						><input
							type="checkbox"
							bind:checked={accessRow.admin}
							onchange={() => setAccess(accessRow)}
							disabled={!store._embedded.access.admin}
						/></td
					>
					<td
						><button
							onclick={() => removeAccess(accessRow.id, accessRow.type)}
							disabled={!store._embedded.access.admin}>SLETT</button
						></td
					>
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

	table.access-list {
		width: 100%;
	}

	table.access-list td:nth-child(2),
	table.access-list th:nth-child(2) {
		min-width: 200px;
		white-space: nowrap;
	}

	td.combobox-cell {
		position: relative;
	}

	ul.suggestions {
		position: absolute;
		z-index: 10;
		background: white;
		border: 1px solid darkgray;
		margin: 0;
		padding: 0;
		list-style: none;
		min-width: 300px;
		max-height: 200px;
		overflow-y: auto;
	}

	ul.suggestions li button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 4px 8px;
		background: none;
		border: none;
		cursor: pointer;
		white-space: nowrap;
	}

	ul.suggestions li button:hover {
		background-color: #c9c189;
	}

	td.selected-id {
		font-size: 0.85em;
		color: #555;
		font-family: monospace;
	}
</style>
