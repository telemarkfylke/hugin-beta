<script lang="ts">
	import type { VectorMatch, VectorSearch, StoreResponse } from "$lib/ragservice/types";
	import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi";
  import { afterNavigate } from "$app/navigation";

	const api = new RagServiceApi();
	type Props = {
		store: StoreResponse;
	};
	let { store: store }: Props = $props();
	
	let responses: VectorMatch[] = $state([]);
	//let query: string = $state("");

	const query:VectorSearch = $state({
		text:"",
		replyLimit: 3,
		storeIds:[store.storeId],
		weights: {
		text: 5,
		vector: 5,
	}

	});


	async function search() {
		responses = await api.textSearch(store.storeId, query);
	}

	afterNavigate(() => {
	});
</script>

<main>

<table>
	<tbody>
		<tr><td rowspan="3"><textarea rows="4" class="searchtext" bind:value={query.text} placeholder="Søketekst"></textarea></td><td>Antall svar</td><td>{query.replyLimit}</td><td><input type="range" min="0" max="10" bind:value={query.replyLimit} /></td>
		<td rowspan="3"><button onclick={() => {search()} } disabled= {!store._embedded.access.search}>Søk</button></td></tr>
		<tr><td>Vektlegg tekst</td><td>{query.weights.text}</td><td><input type="range" min="0" max="10" bind:value={query.weights.text} /></td></tr>
		<tr><td>Vektlegg vector</td><td>{query.weights.vector}</td><td><input type="range" min="0" max="10" bind:value={query.weights.vector} /></td></tr>
	</tbody>
</table>


<table>
	<thead>
		<tr>
			<!--th>Id</th-->
			<th>Tekst</th>
			<th>Score</th>
			<th>Meta</th>
		</tr>
	</thead>
	<tbody>
		{#each responses as response}
			<tr>
				<!--td>{file.id}</td-->
				<td>{response.text}</td>
				<td>{response.score}</td>
				<td>{JSON.stringify(response.meta)}</td>
			</tr>
		{/each}
	</tbody>
</table>
</main>

<style>
	table {
		border-collapse: collapse;
	}

	td {
		border: 1px solid black;
		min-width: 20px;
		padding: 5px;
	}

	tr {
		border-bottom: 1px solid rgb(73, 73, 73);
		margin-bottom: 5px;
	}

	textarea.searchtext {
		width: 282px; 
		height: 67px;
	}
</style>