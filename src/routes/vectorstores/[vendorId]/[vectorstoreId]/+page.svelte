<script lang="ts">
	import { page } from "$app/state"
	import { parseSse } from "$lib/streaming"
	import { GetVendorVectorStoreFilesResponse, GetVendorVectorStoreResponse } from "$lib/types/api-responses"
	import type { VectorStoreFile } from "$lib/types/vector-store"

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

	const vendorId: string = $state(page.params.vendorId) as string
	const vectorstoreId: string = $state(page.params.vectorstoreId) as string

	if (!page.params.vendorId || !page.params.vectorstoreId) {
		throw new Error()
	}

	let uploadVectorStoreFiles = $state(new DataTransfer().files)

	const submitFiles = () => {
		if (uploadVectorStoreFiles.length > 0) {
			uploadVendorVectorStoreFiles(vendorId, vectorstoreId, uploadVectorStoreFiles)
			uploadVectorStoreFiles = new DataTransfer().files // Clear files after submission
		}
	}

	const deleteFile = async (fileId: string) => {
		const res = await fetch(`/api/vectorstores/${page.params.vendorId}/${page.params.vectorstoreId}/vectorstorefiles/${fileId}`, {
			method: "DELETE"
		})
		if (!res.ok) {
			throw new Error(`Failed to delete vector store file: ${fileId}`)
		}

		await getVectorStoreFiles()
	}

	const getVectorStore = async () => {
		const res = await fetch(`/api/vectorstores/${page.params.vendorId}/${page.params.vectorstoreId}`)
		if (!res.ok) {
			throw new Error("Failed to fetch vector stores")
		}
		// Get json and validate
		const result = GetVendorVectorStoreResponse.parse(await res.json()) // Validate response
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
			// Get json and validate
			const result = GetVendorVectorStoreFilesResponse.parse(await res.json()) // Validate response
			vectorstoreFiles.files = result.files
		} catch (error) {
			vectorstoreFiles.error = error instanceof Error ? error.message : String(error)
		}
		vectorstoreFiles.isLoading = false
	}

	const uploadVendorVectorStoreFiles = async (vendorId: string, vectorStoreId: string, files: FileList): Promise<void> => {
		if (!files || files.length === 0) {
			throw new Error("No files provided for upload")
		}
		// OBS mulig vi vil støtte opplasting uten conversationId også senere? TODO, sjekk om det skal gjøres her, eller i AgentState eller i API.
		const formData = new FormData()
		formData.append("stream", "true") // assuming we want always want streaming in frontend
		for (let i = 0; i < files.length; i++) {
			formData.append("files[]", files[i] as File)
		}
		const response = await fetch(`/api/vectorstores/${vendorId}/${vectorStoreId}/vectorstorefiles`, {
			method: "POST",
			body: formData
		})
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`)
		}
		if (!response.body) {
			throw new Error("Response body is null")
		}
		try {
			const reader = response.body.getReader()
			const decoder = new TextDecoder("utf-8")
			while (true) {
				const { value, done } = await reader.read()
				const chatResponseText = decoder.decode(value, { stream: true })
				const uploadResponse = parseSse(chatResponseText)
				for (const uploadResult of uploadResponse) {
					switch (uploadResult.event) {
						case "vendor.vectorstore.file.processed": {
							const { fileId, fileName } = uploadResult.data
							console.log(`File uploaded: ${fileName} (ID: ${fileId})`)
							getVectorStoreFiles()
							break
						}
						default:
							console.warn("Unhandled upload result event:", uploadResult)
							break
					}
				}
				if (done) break
			}
		} catch (error) {
			console.error("Error uploading files to agent vector store:", error)
		}
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

<input
	bind:files={uploadVectorStoreFiles}
	type="file"
	id="vector-store-file-upload"
/>
<button type="button" onclick={submitFiles}>Last opp</button>

{#if vectorstoreFiles.isLoading}
	<p>Loading vector store files...</p>
{:else if vectorstoreFiles.error}
	<p style="color: red;">Error: {vectorstoreFiles.error}</p>
{:else if vectorstoreFiles.files.length === 0}
	<p>No files found in this vector store.</p>
{:else}
	<ul>
		{#each vectorstoreFiles.files as file}
			<li>
				{file.name} - {file.bytes} bytes
				<button type="button" onclick={() => deleteFile(file.id)}>Delete</button
				>
			</li>
		{/each}
	</ul>
{/if}
