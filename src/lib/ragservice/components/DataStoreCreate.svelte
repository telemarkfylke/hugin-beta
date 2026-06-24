<script lang="ts">
	import { RagServiceApi } from "../adapters/ragserviceApi";
	import { onMount } from 'svelte';
	import type {
		CreateVectorStoreInput,
		EmbeddingDimensions,
		EmbeddingModel,
        StoreConfig,
	} from "../types";

	type Props = {
		onDone: (storeId: StoreConfig | null) => void
	};

	
	let { onDone }: Props = $props();

	let methodOptions: EmbeddingModel[] = $state(["embeddinggemma:300m"]);
	let dimensionsOptions: EmbeddingDimensions[] = $state([]);

	const store: CreateVectorStoreInput = $state({
		name: "",
		description: "",
		embeddingMethod: "embeddinggemma:300m",
		dimensions: 1024,
	});

	const api = new RagServiceApi();

	async function loadModels() {
		methodOptions = await api.getModels();
		await loadDimensions();
	}

	async function loadDimensions() {
		dimensionsOptions = await api.getDimensions(store.embeddingMethod);
		if (!dimensionsOptions.includes(store.dimensions)) {
			if (dimensionsOptions.length > 0) {
				store.dimensions = dimensionsOptions[0]!;
			}
		}
	}

	async function addStore() {
		const reply = await api.createStore(store);
		onDone(reply)
	}

	async function cancel() {
		onDone(null)
	}

	onMount(() => {
		loadModels();
	});
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
