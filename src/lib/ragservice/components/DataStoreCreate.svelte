<script lang="ts">
	import { onMount } from "svelte"
	import { RagServiceApi } from "../adapters/ragserviceApi"
	import type { CreateVectorStoreInput, EmbeddingDimensions, EmbeddingModel, StoreConfig } from "../types"

	type Props = {
		onDone: (storeId: StoreConfig | null) => void
	}

	let { onDone }: Props = $props()

	let methodOptions: EmbeddingModel[] = $state(["embeddinggemma:300m"])
	let dimensionsOptions: EmbeddingDimensions[] = $state([])

	const store: CreateVectorStoreInput = $state({
		name: "",
		description: "",
		embeddingMethod: "embeddinggemma:300m",
		dimensions: 1024,
		searchOptions: null
	})

	let useWeights = $state(false)
	let weightsText = $state(0.5)

	let useThresholds = $state(false)
	let thresholdsText = $state(0)
	let thresholdsVector = $state(0.7)
	let thresholdsLogic: "and" | "or" = $state("or")

	$effect(() => {
		if (!useWeights && !useThresholds) {
			store.searchOptions = null
			return
		}
		store.searchOptions = {
			weights: useWeights ? { text: weightsText, vector: 1 - weightsText } : null,
			thresholds: useThresholds ? { text: thresholdsText, vector: thresholdsVector, logic: thresholdsLogic } : null
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

	async function addStore() {
		const reply = await api.createStore(store)
		onDone(reply)
	}

	async function cancel() {
		onDone(null)
	}

	onMount(() => {
		loadModels()
	})
</script>

<main>
	<table>
		<tbody>
			<tr><td>Navn</td><td>:</td><td><input bind:value={store.name} /></td></tr>
			<tr
				><td>Beskrivelse</td><td>:</td><td
					><input bind:value={store.description} /></td
				></tr
			>
			<tr
				><td>Method</td><td>:</td><td>
					<select
						bind:value={store.embeddingMethod}
						onchange={() => {
							loadDimensions();
						}}
					>
						{#each methodOptions as option}
							<option value={option}>{option}</option>
						{/each}
					</select></td
				></tr
			>
			<tr
				><td>Dimensions</td><td>:</td><td>
					<select bind:value={store.dimensions}>
						{#each dimensionsOptions as option}
							<option value={option}>{option}</option>
						{/each}
					</select></td
				></tr
			>

			<tr>
				<td colspan="3">
					<label><input type="checkbox" bind:checked={useWeights} /> Egendefinert vekting</label>
				</td>
			</tr>
			{#if useWeights}
				<tr>
					<td>Vector &lt;-&gt; Tekst</td>
					<td>{(1 - weightsText).toFixed(1)} / {weightsText.toFixed(1)}</td>
					<td><input type="range" step="0.1" min="0" max="1" bind:value={weightsText} /></td>
				</tr>
			{/if}

			<tr>
				<td colspan="3">
					<label><input type="checkbox" bind:checked={useThresholds} /> Egendefinerte terskler</label>
				</td>
			</tr>
			{#if useThresholds}
				<tr>
					<td>Text Treshhold</td>
					<td>{thresholdsText}</td>
					<td><input type="range" step="1" min="0" max="50" bind:value={thresholdsText} /></td>
				</tr>
				<tr>
					<td>Vector Treshhold</td>
					<td>{thresholdsVector}</td>
					<td><input type="range" step="0.01" min="0" max="1" bind:value={thresholdsVector} /></td>
				</tr>
				<tr>
					<td>Logikk</td>
					<td colspan="2">
						<select bind:value={thresholdsLogic}>
							<option value="or">Eller (or)</option>
							<option value="and">Og (and)</option>
						</select>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
	<div class="actions">
		<button onclick={() => {cancel()}}>Avbryt</button>
		<button onclick={() => {addStore()}}>Legg til</button>
	</div>
</main>

<style>
	div.actions {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}
</style>
