<script lang="ts">
	import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi"
	import type { SearchOptions, StoreResponse, VectorMatch, VectorSearch } from "$lib/ragservice/types"
	import "./ragservice-shared.css"
	import InfoTooltip from "./InfoTooltip.svelte"
	import NullableBooleanField from "./NullableBooleanField.svelte"
	import NullableRangeField from "./NullableRangeField.svelte"

	const api = new RagServiceApi()

	type Props = {
		store: StoreResponse
	}
	let { store }: Props = $props()

	let responses: VectorMatch[] = $state([])
	let editingId: string | null = $state(null)
	let editText: string = $state("")
	let saving: boolean = $state(false)

	let weightsText: number = $state(store.searchOptions?.weights?.text ?? 0.5)

	let thresholdsText: number | null = $state(store.searchOptions?.thresholds?.text ?? null)
	let thresholdsVector: number | null = $state(store.searchOptions?.thresholds?.vector ?? null)
	let thresholdsLogic: "and" | "or" = $state(store.searchOptions?.thresholds?.logic ?? "or")
	let rerank: boolean | null = $state(store.searchOptions?.rerank ?? null)

	const query: VectorSearch = $state({
		text: "",
		replyLimit: 3,
		storeIds: [store.storeId],
		weights: null,
		thresholds: null,
		rerank: null
	})

	$effect(() => {
		query.weights = { text: weightsText, vector: 1 - weightsText }
	})

	$effect(() => {
		query.thresholds = { text: thresholdsText, vector: thresholdsVector, logic: thresholdsLogic }
	})

	$effect(() => {
		query.rerank = rerank
	})

	async function search() {
		responses = await api.textSearch(store.storeId, query)
	}

	let savingDefaults = $state(false)
	let saveDefaultsMessage: string | null = $state(null)

	async function saveAsStoreDefaults() {
		savingDefaults = true
		saveDefaultsMessage = null
		const searchOptions: SearchOptions = {
			weights: { text: weightsText, vector: 1 - weightsText },
			thresholds: { text: thresholdsText, vector: thresholdsVector, logic: thresholdsLogic },
			rerank
		}
		try {
			const updated = await api.updateStore(store.storeId, { searchOptions })
			saveDefaultsMessage = updated ? "Lagret som standard for biblioteket." : "Kunne ikke lagre."
		} finally {
			savingDefaults = false
		}
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

<div class="rag-card">
	<div class="search-layout">
		<textarea rows="8" class="searchtext" bind:value={query.text} placeholder="Søketekst"></textarea>

		<div class="rag-field-grid search-options">
			<div class="rag-field">
				<span class="rag-field-label">Antall svar <InfoTooltip text="Maks antall treff som returneres fra søket." /></span>
				<input type="range" min="0" max="10" bind:value={query.replyLimit} />
				<span class="rag-field-value">{query.replyLimit}</span>
			</div>

			<h4 class="rag-section-title">Vekting</h4>
			<div class="rag-field">
				<span class="rag-field-label">
					Vector &lt;-&gt; Tekst
					<InfoTooltip
						text="Balanse mellom semantisk (vector) søk og tekst-/nøkkelordsøk. Helt til venstre = kun vector, helt til høyre = kun tekst."
					/>
				</span>
				<input type="range" step="0.1" min="0" max="1" bind:value={weightsText} />
				<span class="rag-field-value">{(1 - weightsText).toFixed(1)} / {weightsText.toFixed(1)}</span>
			</div>

			<h4 class="rag-section-title">Terskler</h4>
			<NullableRangeField
				label="Text Treshhold"
				min={0}
				max={50}
				step={1}
				bind:value={thresholdsText}
				help="Minimum tekst-score et treff må ha for å bli tatt med. Skru av for å ikke filtrere på tekst-score."
			/>
			<NullableRangeField
				label="Vector Treshhold"
				min={0}
				max={1}
				step={0.01}
				decimals={2}
				bind:value={thresholdsVector}
				help="Minimum vector-score (semantisk likhet) et treff må ha for å bli tatt med. Skru av for å ikke filtrere på vector-score."
			/>
			<div class="rag-simple-field">
				<span class="rag-field-label">
					Logikk
					<InfoTooltip text="'And' krever at treffet passerer både tekst- og vector-terskel. 'Or' krever at minst én av dem er oppfylt." />
				</span>
				<select bind:value={thresholdsLogic}>
					<option value="and">And</option>
					<option value="or">Or</option>
				</select>
			</div>
			<NullableBooleanField
				label="Rerank"
				bind:value={rerank}
				help="Ekstra steg som sorterer treffene på nytt for bedre relevans, på bekostning av noe høyere søketid. 'Ikke satt' bruker standard oppførsel."
			/>
		</div>
	</div>

	<div class="search-actions">
		<button class="filled" onclick={() => search()} disabled={!store._embedded.access.search}>Søk</button>

		{#if store._embedded.access.admin}
			<button onclick={() => saveAsStoreDefaults()} disabled={savingDefaults}>
				Lagre som standard for biblioteket
			</button>
			{#if saveDefaultsMessage}
				<span class="rag-muted">{saveDefaultsMessage}</span>
			{/if}
		{/if}
	</div>
</div>

{#if responses.length > 0}
	<table class="rag-table results">
		<thead>
			<tr>
				<th>Tekst</th>
				<th>Sort score</th>
				<th>Vector score</th>
				<th>Text Score</th>
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
					<td class="score-cell">{response.vectorScore?.toFixed(3)}</td>
					<td class="score-cell">{response.textScore?.toFixed(3)}</td>

					<td class="actions-cell">
						{#if editingId === response.id}
							<button onclick={() => saveEdit(response)} disabled={saving}>Lagre</button>
							<button onclick={cancelEdit}>Avbryt</button>
						{:else}
							<button
								class="icon-button"
								onclick={() => startEdit(response)}
								disabled={!response.id || !store._embedded.access.upload}
								title={!response.id ? "Mangler chunk-id i søkeresultat" : "Rediger"}
							>
								<span class="material-symbols-outlined">edit</span>
							</button>
							<button
								class="icon-button danger"
								onclick={() => deleteChunk(response)}
								disabled={!response.id || !store._embedded.access.upload}
								title={!response.id ? "Mangler chunk-id i søkeresultat" : "Slett"}
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
	div.search-layout {
		display: flex;
		gap: 20px;
		align-items: flex-start;
	}

	textarea.searchtext {
		width: 282px;
		height: 100%;
		box-sizing: border-box;
		resize: vertical;
		font: inherit;
		padding: 8px;
		border: 1px solid var(--color-primary-30);
		border-radius: 4px;
	}

	div.search-options {
		flex: 1;
	}

	div.search-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 20px;
	}

	table.results {
		margin-top: 16px;
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
		background: var(--color-primary-10);
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

	button.danger {
		color: var(--color-danger);
		border-color: var(--color-danger);
	}
</style>
