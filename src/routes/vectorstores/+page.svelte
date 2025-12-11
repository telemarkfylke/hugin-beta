<script lang="ts">
    import { GetVectorStoresResponse } from "$lib/types/api-responses";
	import type { VectorStore } from "$lib/types/vector-store"

	type FrontendVectorStores = {
		isLoading: boolean
		error: string | null
		value: VectorStore[]
	}

	let vectorstores: FrontendVectorStores = $state({
		isLoading: false,
		error: null,
		value: []
	})

	const getVectorStores = async () => {
		vectorstores.isLoading = true
		vectorstores.error = null
		vectorstores.value = []
		try {
			const res = await fetch("/api/vectorstores")
			if (!res.ok) {
				throw new Error(`Failed to fetch vector stores: ${res.statusText}`)
			}
			// get json and validate
			const result = GetVectorStoresResponse.parse(await res.json()) // Validate response
			vectorstores.value = result.vectorstores
		} catch (error) {
			vectorstores.error = error instanceof Error ? error.message : String(error)
		}
		vectorstores.isLoading = false
	}

	const deleteVectorStore = async (event: Event, vendorId: string, vectorstoreId: string) => {
		// Set eventTarget to disabled and loading
		const buttonTarget = event.target as HTMLButtonElement
		const originalText = buttonTarget.textContent
		buttonTarget.disabled = true
		buttonTarget.textContent = "Deleting..."
		try {
			const res = await fetch(`/api/vectorstores/${vendorId}/${vectorstoreId}`, {
				method: "DELETE"
			})
			if (!res.ok) {
				throw new Error(`Failed to delete vector store: ${res.statusText}`)
			}
			// Filter out the deleted vector store from the list
			vectorstores.value = vectorstores.value.filter((store) => !(store.vendorId === vendorId && store.id === vectorstoreId))
			console.log("Vector store deleted successfully")
		} catch (error) {
			console.error("Error deleting vector store:", error)
		}
		// Svelte has something funny - the element below the one with delete inherits the button somehow - so we need to enable it again...
		buttonTarget.disabled = false
		buttonTarget.textContent = originalText
	}

	// Then get them
	getVectorStores()
</script>

<h1>Vector store Page</h1>
{#if vectorstores.isLoading}
  <p>Loading vector stores...</p>
{:else if vectorstores.error}
  <p style="color: red;">Error: {vectorstores.error}</p>
{:else}
  {#if vectorstores.value.length === 0}
    <p>No vector stores found.</p>
  {:else}
    <ul>
      {#each vectorstores.value as store}
        <li id="vectorstore-{store.vendorId}-{store.id}">
          <a id="vectorstore-link-{store.vendorId}-{store.id}" href="/vectorstores/{store.vendorId}/{store.id}">{store.name} - {store.numberOfFiles} filer</a>
          <button id="vectorstore-delete-{store.vendorId}-{store.id}" onclick={(event: Event) => deleteVectorStore(event, store.vendorId, store.id)}>Delete</button>
        </li>
      {/each}
    </ul>
  {/if}
{/if}