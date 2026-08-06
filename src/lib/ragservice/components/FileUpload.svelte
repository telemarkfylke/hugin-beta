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
	let uploadError: string | null = $state(null)

	async function handleUpload() {
		if (!fileInput.files || fileInput.files.length === 0) return

		uploading = true
		uploadError = null
		try {
			const formData = new FormData()
			for (let i = 0; i < fileInput.files.length; i++) {
				formData.append("files[]", fileInput.files[i] as File)
			}
			const res = await api.uploadFile(storeId, formData, normalizeChuncks)
			if (!res.ok) {
				uploadError = res.status === 415 ? "Filtypen støttes ikke av datakilden" : `Opplasting feilet (${res.status})`
				return
			}
			onFileUploaded()
		} finally {
			uploading = false
			fileInput.value = ""
		}
	}
</script>

<form
	class="upload-form"
	onsubmit={(e) => {
		e.preventDefault();
		handleUpload();
	}}
>
	<input
		id="file-to-upload"
		type="file"
		bind:this={fileInput}
		accept=".txt,.md,.csv,.json,.log,.yaml,.yml,.html,.htm,.xml,.pdf,.docx,.pptx,.xlsx,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	/>
	<label><input type="checkbox" bind:checked={normalizeChuncks} /> Normaliser chunks</label>
	<button type="submit" class="filled" disabled={uploading}>
		{uploading ? "Laster opp..." : "Last opp"}
	</button>
</form>

{#if uploadError}
	<p class="error">{uploadError}</p>
{/if}

<style>
	form.upload-form {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}

	p.error {
		color: var(--color-danger);
		margin-top: 12px;
	}

	form.upload-form label {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.9rem;
	}

	form.upload-form input[type="checkbox"] {
		accent-color: var(--color-primary);
	}
</style>
