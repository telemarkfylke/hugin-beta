<script lang="ts">
	//import { getMsalClient, login } from "$lib/auth/msal-auth";
	//import { page } from "$app/stores";
	import { afterNavigate, goto } from "$app/navigation";
	import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi";
	import type { StoreConfig, StoreResponse } from "$lib/ragservice/types";
	import DataStore from "$lib/ragservice/components/DataStore.svelte";
	import DataStoreCreate from "$lib/ragservice/components/DataStoreCreate.svelte";
	
	
	let stores: StoreConfig[] = $state([]);

	const api = new RagServiceApi();
	let storeId: string | null = $state(null);
	let store: StoreResponse | null = $state(null);



	// Variabel som får "kontoobjektet" fra innlogget bruker fra MSAL
	//let account: any = $state(null);

	async function search() {
		stores = await api.getStores();
	}

	
	$effect(() => {
		if (storeId && storeId !== 'new') {
			api.getStore(storeId, true).then(s => { store = s; });
		}
	});


	async function createNew() {
		goto("/stores/new");
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
		await search();
	});
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
