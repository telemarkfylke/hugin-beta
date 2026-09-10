<script lang="ts">
	import { afterNavigate } from "$app/navigation"
	import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi"
	import DataStore from "$lib/ragservice/components/DataStore.svelte"
	import type { StoreConfig } from "$lib/ragservice/types"

	let stores: StoreConfig[] = $state([])

	const api = new RagServiceApi()

	async function search() {
		stores = await api.getStores()
	}

	afterNavigate(async () => {
		await search()
	})
</script>

<p class="lead">
	Opprett og administrer biblioteker med dokumenter som AI-agenter kan søke i for å svare med informasjon fra egne kilder. Last opp filer, juster søkeinnstillinger, og styr hvem som har tilgang til hvert bibliotek.
</p>

<DataStore {stores} />

<style>
	.lead {
		color: var(--color-primary-80);
		margin-top: 0;
		margin-bottom: 1.5rem;
	}
</style>
