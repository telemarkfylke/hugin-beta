<script lang="ts">
	import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte"
	import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi"
	import { RERANK_ENABLED } from "$lib/ragservice/feature-flags"
	import type { SearchOptions, StoreResponse, VectorMatch, VectorSearch } from "$lib/ragservice/types"
	import "./ragservice-shared.css"
	import InfoTooltip from "./InfoTooltip.svelte"
	import LogicRadioField from "./LogicRadioField.svelte"
	import NullableBooleanField from "./NullableBooleanField.svelte"
	import NullableRangeField from "./NullableRangeField.svelte"
	import VennLogicIcon from "./VennLogicIcon.svelte"

	const api = new RagServiceApi()
	const REPLY_LIMIT_OPTIONS = Array.from({ length: 11 }, (_, i) => i)

	type Props = {
		store: StoreResponse
		onSaved: () => void
	}
	let { store, onSaved }: Props = $props()

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

	let searching = $state(false)
	let searchError: string | null = $state(null)
	let hasSearched = $state(false)

	async function search() {
		searching = true
		searchError = null
		try {
			responses = await api.textSearch(store.storeId, query)
		} catch {
			responses = []
			searchError = "Noe gikk galt under søket. Prøv igjen."
		} finally {
			searching = false
			hasSearched = true
		}
	}

	let savingDefaults = $state(false)
	let justSavedDefaults = $state(false)
	let saveDefaultsError: string | null = $state(null)

	// Confirmation lives in the button's own label (Lagrer... -> Lagret ✓ -> back to normal)
	// rather than a separate message next to it, so nothing shifts when it appears, and it
	// clears itself instead of sitting there indefinitely. Errors are worth not missing, so
	// those get their own persistent line below instead - see saveDefaultsError below.
	const SAVED_CONFIRMATION_MS = 2000

	async function saveAsStoreDefaults() {
		savingDefaults = true
		justSavedDefaults = false
		saveDefaultsError = null
		const searchOptions: SearchOptions = {
			weights: { text: weightsText, vector: 1 - weightsText },
			thresholds: { text: thresholdsText, vector: thresholdsVector, logic: thresholdsLogic },
			rerank
		}
		try {
			const updated = await api.updateStore(store.storeId, { searchOptions })
			if (updated) {
				onSaved()
				justSavedDefaults = true
				setTimeout(() => {
					justSavedDefaults = false
				}, SAVED_CONFIRMATION_MS)
			} else {
				saveDefaultsError = "Kunne ikke lagre."
			}
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

	let chunkToDelete: VectorMatch | null = $state(null)
	let showDeleteConfirm = $state(false)

	function askDeleteChunk(response: VectorMatch) {
		if (!response.id) return
		chunkToDelete = response
		showDeleteConfirm = true
	}

	async function deleteChunk() {
		if (!chunkToDelete?.id) return
		await api.deleteChunk(store.storeId, chunkToDelete.id)
		responses = responses.filter((r) => r.id !== chunkToDelete?.id)
		chunkToDelete = null
	}
</script>

<div class="rag-card">
	<div class="search-layout">
		<div class="search-input-col">
			<textarea rows="8" class="searchtext" bind:value={query.text} placeholder="Søketekst"></textarea>

			<div class="search-input-actions">
				<div class="reply-limit-field">
					<span class="rag-field-label">Antall svar <InfoTooltip text="Maks antall treff som returneres fra dette søket." /></span>
					<select bind:value={query.replyLimit}>
						{#each REPLY_LIMIT_OPTIONS as n (n)}
							<option value={n}>{n}</option>
						{/each}
					</select>
				</div>

				<button class="search-button" onclick={() => search()} disabled={!store._embedded.access.search || searching}>
					{searching ? "Søker..." : "Søk"}
				</button>
			</div>
		</div>

		<div class="search-tuning-col">
			<p class="tuning-intro">
				Vektingen og tersklene under brukes i søket til venstre, slik at du kan prøve deg frem. De er ikke lagret før du trykker «Lagre som standard for biblioteket» nederst.
			</p>

			<h4 class="rag-section-title">Vekting</h4>
			<div class="rag-field-grid">
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
			</div>

			<h4 class="rag-section-title">Terskler</h4>
			<div class="rag-field-grid">
				<NullableRangeField
					label="Text Threshold"
					min={0}
					max={50}
					step={1}
					bind:value={thresholdsText}
					help="Minimum tekst-score et treff må ha for å bli tatt med. Skru av for å ikke filtrere på tekst-score."
				/>

				<!-- EXPERIMENT: Logikk moved to sit between the two thresholds it actually combines,
				     instead of below both - highlighted as its own sub-row, with a Venn glyph that
				     updates with the selection (see .mode-and/.mode-or below), so the effect of
				     And/Or is shown, not just named. The icon is passed in via a snippet rather than
				     baked into LogicRadioField, since it's specific to this one experimental spot. -->
				<LogicRadioField
					highlight
					disabled={thresholdsText === null || thresholdsVector === null}
					bind:value={thresholdsLogic}
					help="'And' krever at treffet passerer både tekst- og vector-terskel. 'Or' krever at minst én av dem er oppfylt."
				>
					{#snippet icon()}
						<VennLogicIcon mode={thresholdsLogic} />
					{/snippet}
				</LogicRadioField>

				<NullableRangeField
					label="Vector Threshold"
					min={0}
					max={1}
					step={0.01}
					decimals={2}
					bind:value={thresholdsVector}
					help="Minimum vector-score (semantisk likhet) et treff må ha for å bli tatt med. Skru av for å ikke filtrere på vector-score."
				/>
				{#if RERANK_ENABLED}
					<NullableBooleanField
						label="Rerank"
						bind:value={rerank}
						help="Ekstra steg som sorterer treffene på nytt for bedre relevans, på bekostning av noe høyere søketid. 'Ikke satt' bruker standard oppførsel."
					/>
				{/if}
			</div>

			{#if store._embedded.access.admin}
				<div class="tuning-save">
					<p class="rag-muted">
						Lagrer vektingen og tersklene over som standard for hele biblioteket - altså for alle fremtidige søk, ikke bare dette. Søketeksten og antall svar til venstre påvirkes ikke.
					</p>
					<div class="tuning-save-actions">
						<button class="filled" onclick={() => saveAsStoreDefaults()} disabled={savingDefaults}>
							{savingDefaults ? "Lagrer..." : justSavedDefaults ? "Lagret ✓" : "Lagre som standard for biblioteket"}
						</button>
					</div>
					{#if saveDefaultsError}
						<p class="save-defaults-error">{saveDefaultsError}</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

{#if searchError}
	<div class="search-state search-state-error">{searchError}</div>
{:else if responses.length > 0}
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
								onclick={() => askDeleteChunk(response)}
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
{:else if hasSearched}
	<div class="search-state search-state-empty">
		Fant ingen treff. Prøv å justere vektingen eller senke tersklene, eller sjekk at biblioteket har filer med innhold lastet opp.
	</div>
{/if}

<ConfirmDeleteDialog
	bind:show={showDeleteConfirm}
	message="Er du sikker på at du vil slette denne chunken?"
	subtext="Chunken fjernes permanent fra søkeindeksen og vil ikke lenger dukke opp i søk. Selve filen den kom fra beholdes - det er bare denne biten av innholdet som forsvinner."
	onConfirm={deleteChunk}
/>

<style>
	div.search-layout {
		display: flex;
		gap: 20px;
		align-items: flex-start;
	}

	div.search-input-col {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 282px;
	}

	div.search-input-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	button.search-button {
		min-width: 80px;
		justify-content: center;
	}

	div.reply-limit-field {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	div.reply-limit-field select {
		font-family: var(--font-family);
		padding: 4px 6px;
		border: 1px solid var(--color-primary-30);
		border-radius: 4px;
	}

	textarea.searchtext {
		width: 100%;
		box-sizing: border-box;
		resize: vertical;
		font: inherit;
		padding: 8px;
		border: 1px solid var(--color-primary-30);
		border-radius: 4px;
	}

	div.search-tuning-col {
		flex: 1;
		background-color: var(--color-primary-10);
		border: 1px solid var(--color-primary-20);
		border-radius: 8px;
		padding: 0.75rem 1.25rem 1.25rem;
	}

	p.tuning-intro {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-primary-80);
		line-height: 1.4;
	}

	div.tuning-save {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--color-primary-20);
	}

	div.tuning-save-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 10px;
	}

	p.save-defaults-error {
		margin: 8px 0 0;
		text-align: right;
		color: var(--color-danger);
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

	div.search-state {
		margin-top: 16px;
		padding: 40px 24px;
		text-align: center;
		font-size: 1.05rem;
		line-height: 1.5;
		border-radius: 8px;
		border: 1px solid var(--color-primary-20);
		background-color: white;
	}

	div.search-state-error {
		color: var(--color-danger);
		border-color: var(--color-danger-70);
		background-color: #fdecef;
	}

	div.search-state-empty {
		color: var(--color-primary-80);
	}

	/* Same breakpoint as the ragservice page wrapper/transcription's grids - below it, the
	   tuning column has no room next to the fixed-width search column, so it drops underneath
	   instead of squeezing sideways. */
	@media (max-width: 768px) {
		div.search-layout {
			flex-direction: column;
		}

		div.search-input-col {
			width: 100%;
		}
	}
</style>
