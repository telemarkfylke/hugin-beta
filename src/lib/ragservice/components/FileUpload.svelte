<script lang="ts">
	import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi"

	type Props = {
		storeId: string
		onFileUploaded: () => void
	}

	let normalizeChuncks: boolean = $state(true)
	let { storeId, onFileUploaded }: Props = $props()

	const api = new RagServiceApi()
	let fileInput: HTMLInputElement
	let uploading = $state(false)

	async function handleUpload() {
		if (!fileInput.files || fileInput.files.length === 0) return

		uploading = true
		try {
			const formData = new FormData()
			for (let i = 0; i < fileInput.files.length; i++) {
				formData.append("files[]", fileInput.files[i] as File)
			}
			await api.uploadFile(storeId, formData, normalizeChuncks)
			onFileUploaded()
		} finally {
			uploading = false
			fileInput.value = ""
		}
	}
</script>

<form onsubmit={(e) => { e.preventDefault(); handleUpload(); }}>
	<label><input type="checkbox" bind:checked={normalizeChuncks} />Normaliser chunks</label>
	<input id="file-to-upload" type="file" bind:this={fileInput} />
	<button type="submit" disabled={uploading}>
		{uploading ? "Laster opp..." : "Last opp"}
	</button>
</form>
