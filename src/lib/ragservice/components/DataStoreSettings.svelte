<script lang="ts">
	import { RagServiceApi } from "../adapters/ragserviceApi"
	import { RERANK_ENABLED } from "../feature-flags"
	import type { StoreResponse, UpdateStoreValues } from "../types"
	import "./ragservice-shared.css"
	import InfoTooltip from "./InfoTooltip.svelte"
	import NullableBooleanField from "./NullableBooleanField.svelte"
	import NullableRangeField from "./NullableRangeField.svelte"

	type Props = {
		store: StoreResponse
		onSaved: () => void
	}
	let { store, onSaved }: Props = $props()

	const api = new RagServiceApi()

	let name = $state(store.name)
	let description = $state(store.description)

	let weightsText: number = $state(store.searchOptions?.weights?.text ?? 0.5)

	let thresholdsText: number | null = $state(store.searchOptions?.thresholds?.text ?? null)
	let thresholdsVector: number | null = $state(store.searchOptions?.thresholds?.vector ?? null)
	let thresholdsLogic: "and" | "or" = $state(store.searchOptions?.thresholds?.logic ?? "or")
	let rerank: boolean | null = $state(store.searchOptions?.rerank ?? null)

	let saving = $state(false)
	let saveError: string | null = $state(null)

	async function save() {
		saving = true
		saveError = null
		const values: UpdateStoreValues = {
			name,
			description,
			searchOptions: {
				weights: { text: weightsText, vector: 1 - weightsText },
				thresholds: { text: thresholdsText, vector: thresholdsVector, logic: thresholdsLogic },
				rerank
			}
		}
		try {
			const updated = await api.updateStore(store.storeId, values)
			if (updated) {
				onSaved()
			} else {
				saveError = "Kunne ikke lagre innstillinger"
			}
		} finally {
			saving = false
		}
	}
</script>

<main class="rag-card">
	<h3 class="rag-section-title">Bibliotek</h3>
	<div class="rag-field-grid">
		<div class="rag-simple-field">
			<span class="rag-field-label">Navn</span>
			<input type="text" bind:value={name} />
		</div>
		<div class="rag-simple-field">
			<span class="rag-field-label">Beskrivelse</span>
			<input type="text" bind:value={description} />
		</div>
	</div>

	<h3 class="rag-section-title">Søkevekting</h3>
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

	<h3 class="rag-section-title">Terskler</h3>
	<div class="rag-field-grid">
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
		{#if RERANK_ENABLED}
			<NullableBooleanField
				label="Rerank"
				bind:value={rerank}
				help="Ekstra steg som sorterer treffene på nytt for bedre relevans, på bekostning av noe høyere søketid. 'Ikke satt' bruker standard oppførsel."
			/>
		{/if}
	</div>

	{#if saveError}
		<p class="error">{saveError}</p>
	{/if}

	<div class="actions">
		<button class="filled" onclick={() => save()} disabled={saving}>Lagre</button>
	</div>
</main>

<style>
	div.actions {
		display: flex;
		gap: 8px;
		margin-top: 20px;
	}

	p.error {
		color: var(--color-danger);
		margin-top: 12px;
	}
</style>
