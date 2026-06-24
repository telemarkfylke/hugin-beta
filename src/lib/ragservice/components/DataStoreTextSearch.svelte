<script lang="ts">
	import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi"
	import type { StoreResponse, VectorMatch, VectorSearch } from "$lib/ragservice/types"

	const api = new RagServiceApi()

	type Props = {
		store: StoreResponse
	}
	let { store }: Props = $props()

	let responses: VectorMatch[] = $state([])
	let editingId: string | null = $state(null)
	let editText: string = $state("")
	let saving: boolean = $state(false)

	const query: VectorSearch = $state({
		text: "",
		replyLimit: 3,
		storeIds: [store.storeId],
		weights: { text: 5, vector: 5 }
	})

	async function search() {
		responses = await api.textSearch(store.storeId, query)
	}

	function startEdit(response: VectorMatch) {
		editingId = response.id ?? null
		editText = response.text
	}

	function cancelEdit() {
		editingId = null
		editText = ""
	}

	async function saveEdit(response: VectorMatch) {
		if (!response.id) return
		saving = true
		try {
			await api.updateChunk(store.storeId, response.id, { data: editText })
			response.text = editText
			editingId = null
		} finally {
			saving = false
		}
	}

	async function deleteChunk(response: VectorMatch) {
		if (!response.id) return
		if (!confirm("Slette denne chunken?")) return
		await api.deleteChunk(store.storeId, response.id)
		responses = responses.filter((r) => r.id !== response.id)
	}
</script>

<div class="search-form">
	<table>
		<tbody>
			<tr>
				<td rowspan="3">
					<textarea rows="4" class="searchtext" bind:value={query.text} placeholder="Søketekst"></textarea>
				</td>
				<td>Antall svar</td>
				<td>{query.replyLimit}</td>
				<td><input type="range" min="0" max="10" bind:value={query.replyLimit} /></td>
				<td rowspan="3">
					<button onclick={() => search()} disabled={!store._embedded.access.search}>Søk</button>
				</td>
			</tr>
			<tr>
				<td>Vektlegg tekst</td>
				<td>{query.weights.text}</td>
				<td><input type="range" min="0" max="10" bind:value={query.weights.text} /></td>
			</tr>
			<tr>
				<td>Vektlegg vector</td>
				<td>{query.weights.vector}</td>
				<td><input type="range" min="0" max="10" bind:value={query.weights.vector} /></td>
			</tr>
		</tbody>
	</table>
</div>

{#if responses.length > 0}
	<table class="results">
		<thead>
			<tr>
				<th>Tekst</th>
				<th>Score</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each responses as response}
				<tr>
					<td class="text-cell">
						{#if editingId === response.id}
							<textarea rows="4" bind:value={editText}></textarea>
						{:else}
							{response.text}
							{#if response.extraInfo && Object.keys(response.extraInfo).length > 0}
								<pre class="extra-info">{JSON.stringify(response.extraInfo, null, 2)}</pre>
							{/if}
						{/if}
					</td>
					<td class="score-cell">{response.score.toFixed(3)}</td>
					<td class="actions-cell">
						{#if editingId === response.id}
							<button onclick={() => saveEdit(response)} disabled={saving}>Lagre</button>
							<button onclick={cancelEdit}>Avbryt</button>
						{:else}
							<button
								onclick={() => startEdit(response)}
								disabled={!response.id || !store._embedded.access.upload}
								title={!response.id ? "Mangler chunk-id i søkeresultat" : "Rediger"}
							>
								<span class="material-symbols-outlined">edit</span>
							</button>
							<button
								onclick={() => deleteChunk(response)}
								disabled={!response.id || !store._embedded.access.upload}
								title={!response.id ? "Mangler chunk-id i søkeresultat" : "Slett"}
								class="danger"
							>
								<span class="material-symbols-outlined">delete</span>
							</button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}


<style>
	table {
		border-collapse: collapse;
	}

	td, th {
		border: 1px solid black;
		min-width: 20px;
		padding: 5px;
		text-align: left;
		vertical-align: top;
	}

	textarea.searchtext {
		width: 282px;
		height: 67px;
	}

	table.results {
		width: 100%;
		margin-top: 12px;
	}

	td.text-cell {
		width: 100%;
	}

	td.text-cell textarea {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
	}

	pre.extra-info {
		margin: 4px 0 0;
		font-size: 0.75em;
		color: #888;
		background: #f5f5f5;
		padding: 4px 6px;
		border-radius: 3px;
		max-height: 80px;
		overflow-y: auto;
		white-space: pre-wrap;
		word-break: break-all;
	}

	td.score-cell {
		white-space: nowrap;
		min-width: 60px;
	}

	td.actions-cell {
		white-space: nowrap;
	}

	td.actions-cell button {
		padding: 2px 4px;
	}

	button.danger {
		color: #c00;
	}

	div.add-chunk {
		margin-top: 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 600px;
	}

	div.add-chunk h4 {
		margin: 0;
	}

	div.add-chunk textarea {
		font: inherit;
		padding: 6px;
	}

	div.extra-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	span.extra-info-label {
		font-size: small;
		color: #666;
	}

	div.kv-row {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	div.kv-row input {
		flex: 1;
		font: inherit;
		padding: 3px 6px;
	}

	div.kv-row button {
		padding: 2px 4px;
		background: none;
		border: none;
		cursor: pointer;
		color: #888;
	}

	div.kv-row button:hover {
		color: #c00;
	}

	button.add-field-btn {
		align-self: flex-start;
		font-size: small;
		background: none;
		border: 1px dashed #aaa;
		cursor: pointer;
		padding: 3px 8px;
		display: flex;
		align-items: center;
		gap: 2px;
	}
</style>
