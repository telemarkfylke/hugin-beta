<script lang="ts">
	import { afterNavigate } from "$app/navigation"
	import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi"
	import DataStore from "$lib/ragservice/components/DataStore.svelte"
	import type { StoreConfig } from "$lib/ragservice/types"

	let stores: StoreConfig[] = $state([])

	const api = new RagServiceApi()

	// Variabel som får "kontoobjektet" fra innlogget bruker fra MSAL
	//let account: any = $state(null);

	async function search() {
		stores = await api.getStores()
	}

	afterNavigate(async () => {
		/*
		const authenticate = async () => {
			const msalClient = await getMsalClient();
			if (msalClient.getActiveAccount()) {
				account = msalClient.getActiveAccount();
			}
			if (!account) {
				const loginResponse = await login(false, $page.url.pathname as any); // Sends you to ms auth, and redirects you back here with the msalClient set with active account
				account = loginResponse.account;
				if ($page.url.pathname !== loginResponse.loginRequestUrl) {
					await goto(loginResponse.loginRequestUrl, {
						replaceState: false,
						invalidateAll: true,
					});
				}
			}
		};
		await authenticate();
		*/
		await search()
	})
</script>

<div>
	<!--
	{#if stores != null}
		<DataStoreList bind:stores={stores} onStoreClick={(id:string) => { debugger; storeId = id}}></DataStoreList>
	{/if}
	-->

	<DataStore {stores}></DataStore>

	<style>
		div.home {
			margin: 2px;
		}
	</style>
</div>
