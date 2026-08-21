<script lang="ts">
	import { onMount } from "svelte"
	import { RagServiceApi } from "../adapters/ragserviceApi"
	import { RERANK_ENABLED } from "../feature-flags"
	import type { CreateVectorStoreInput, EmbeddingDimensions, EmbeddingModel, StoreConfig } from "../types"
	import "./ragservice-shared.css"
	import InfoTooltip from "./InfoTooltip.svelte"
	import LogicRadioField from "./LogicRadioField.svelte"
	import NullableBooleanField from "./NullableBooleanField.svelte"
	import NullableRangeField from "./NullableRangeField.svelte"
	import VennLogicIcon from "./VennLogicIcon.svelte"

	type Props = {
		onDone: (storeId: StoreConfig | null) => void
	}

	let { onDone }: Props = $props()

	// TODO: Bare embeddinggemma:300m er reelt støttet foreløpig, så vi skjuler valg av
	// embedding-modell/dimensjoner i UI inntil flere modeller er på plass. Sett til true for å vise dem igjen.
	const showEmbeddingModelFields = false

	let methodOptions: EmbeddingModel[] = $state(["embeddinggemma:300m"])
	let dimensionsOptions: EmbeddingDimensions[] = $state([])

	const store: CreateVectorStoreInput = $state({
		name: "",
		description: "",
		embeddingMethod: "embeddinggemma:300m",
		dimensions: 768,
		searchOptions: null
	})

	let weightsText: number = $state(0.5)

	let thresholdsText: number | null = $state(null)
	let thresholdsVector: number | null = $state(null)
	let thresholdsLogic: "and" | "or" = $state("or")
	let rerank: boolean | null = $state(null)

	$effect(() => {
		store.searchOptions = {
			weights: { text: weightsText, vector: 1 - weightsText },
			thresholds: { text: thresholdsText, vector: thresholdsVector, logic: thresholdsLogic },
			rerank
		}
	})

	const api = new RagServiceApi()

	async function loadModels() {
		methodOptions = await api.getModels()
		await loadDimensions()
	}

	async function loadDimensions() {
		dimensionsOptions = await api.getDimensions(store.embeddingMethod)
		if (!dimensionsOptions.includes(store.dimensions)) {
			if (dimensionsOptions.length > 0) {
				// biome-ignore lint/style/noNonNullAssertion: guarded by dimensionsOptions.length > 0
				store.dimensions = dimensionsOptions[0]!
			}
		}
	}

	let creating = $state(false)
	let createError: string | null = $state(null)

	async function addStore() {
		creating = true
		createError = null
		try {
			const reply = await api.createStore(store)
			if (reply) {
				onDone(reply)
			} else {
				createError = "Kunne ikke opprette biblioteket. Prøv igjen."
			}
		} finally {
			creating = false
		}
	}

	async function cancel() {
		onDone(null)
	}

	onMount(() => {
		loadModels()
	})
</script>

<main class="rag-card">
	<h3 class="rag-section-title">Bibliotek</h3>
	<div class="rag-field-grid">
		<div class="rag-simple-field">
			<span class="rag-field-label">Navn</span>
			<input type="text" bind:value={store.name} />
		</div>
		<div class="rag-simple-field">
			<span class="rag-field-label">Beskrivelse</span>
			<input type="text" bind:value={store.description} />
		</div>
		{#if showEmbeddingModelFields}
			<div class="rag-simple-field">
				<span class="rag-field-label">
					Method
					<InfoTooltip
						text="Embedding-modellen som brukes til å generere vector-representasjoner av tekst i biblioteket. Kan ikke endres etter opprettelse."
					/>
				</span>
				<select
					bind:value={store.embeddingMethod}
					onchange={() => {
						loadDimensions();
					}}
				>
					{#each methodOptions as option}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</div>
			<div class="rag-simple-field">
				<span class="rag-field-label">
					Dimensions
					<InfoTooltip
						text="Antall dimensjoner i vector-representasjonen. Flere dimensjoner kan gi bedre presisjon, men bruker mer lagringsplass. Kan ikke endres etter opprettelse."
					/>
				</span>
				<select bind:value={store.dimensions}>
					{#each dimensionsOptions as option}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</div>			
		{/if}		
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
			label="Text Threshold"
			min={0}
			max={50}
			step={1}
			bind:value={thresholdsText}
			help="Minimum tekst-score et treff må ha for å bli tatt med. Skru av for å ikke filtrere på tekst-score."
		/>

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

	<div class="actions">
		<button onclick={() => cancel()} disabled={creating}>Avbryt</button>
		<button class="filled" onclick={() => addStore()} disabled={creating}>
			{creating ? "Legger til..." : "Legg til"}
		</button>
	</div>

	{#if createError}
		<p class="error">{createError}</p>
	{/if}
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
