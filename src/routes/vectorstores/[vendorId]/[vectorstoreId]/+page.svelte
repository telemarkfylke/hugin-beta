<script lang="ts">
	import { page } from "$app/state"
	import type { VectorStoreFile } from "$lib/types/vector-store"
	import { IVendorResults } from "$lib/types/vendors"

	type FrontendVectorStoreFiles = {
		isLoading: boolean
		error: string | null
		files: VectorStoreFile[]
	}
	let vectorstoreFiles: FrontendVectorStoreFiles = $state({
		isLoading: true,
		error: null,
		files: []
	})

	const getVectorStore = async () => {
		const res = await fetch(`/api/vectorstores/${page.params.vendorId}/${page.params.vectorstoreId}`)
		if (!res.ok) {
			throw new Error("Failed to fetch vector stores")
		}
		const result = IVendorResults.GetVectorStoreResult.parse(await res.json()) // Validate response
		return result.vectorStore
	}

	const getVectorStoreFiles = async () => {
		vectorstoreFiles.isLoading = true
		vectorstoreFiles.error = null
		vectorstoreFiles.files = []
		try {
			const res = await fetch(`/api/vectorstores/${page.params.vendorId}/${page.params.vectorstoreId}/vectorstorefiles`)
			if (!res.ok) {
				throw new Error(`Failed to fetch vector store files: ${res.statusText}`)
			}
			const result = IVendorResults.GetVectorStoreFilesResult.parse(await res.json()) // Validate response
			vectorstoreFiles.files = result.files
		} catch (error) {
			vectorstoreFiles.error = error instanceof Error ? error.message : String(error)
		}
		vectorstoreFiles.isLoading = false
	}

	getVectorStoreFiles()
</script>

<h1>Vectorstore/ID Page</h1>
{#await getVectorStore()}
  <p>Loading vector store...</p>
{:then vectorstore}
  <div>
    <h2>{vectorstore.name}</h2>
    <p>Vendor ID: {vectorstore.vendorId}</p>
    <p>Vector Store ID: {vectorstore.id}</p>
    <p>Description: {vectorstore.description}</p>
  </div>
{:catch error}
  <p style="color: red;">Error: {error.stack || error.message}</p>
{/await}
<h2>Vector Store Files</h2>
{#if vectorstoreFiles.isLoading}
  <p>Loading vector store files...</p>
{:else if vectorstoreFiles.error}
  <p style="color: red;">Error: {vectorstoreFiles.error}</p>
{:else if vectorstoreFiles.files.length === 0}
  <p>No files found in this vector store.</p>
{:else}
  <ul>
    {#each vectorstoreFiles.files as file}
      <li>{file.name} - {file.bytes} bytes</li>
    {/each}
  </ul>
{/if}

