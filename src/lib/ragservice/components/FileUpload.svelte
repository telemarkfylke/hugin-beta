<script lang="ts">
	import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi"
	import type { UseOcr } from "$lib/ragservice/types"

	type Props = {
		storeId: string
		onFileUploaded: () => void
	}

	let normalizeChuncks: boolean = $state(true)
	let useOcr: UseOcr = $state("auto")
	let { storeId, onFileUploaded }: Props = $props()

	const api = new RagServiceApi()
	let fileInput: HTMLInputElement
	let uploading = $state(false)
	let uploadError: string | null = $state(null)
	let uploadNotice: string | null = $state(null)

	// En gateway/proxy kan gi opp og lukke forbindelsen før datakilden er ferdig med å
	// behandle filen (embedding tar tid), uten at vi vet om jobben til slutt lykkes eller
	// feiler. Vi later derfor ikke som vi vet utfallet - vi sier bare at vi ikke fikk svar,
	// og laster fillisten på nytt (flere ganger) så den faktiske statusen kommer til syne.
	function isGatewayTimeout(status: number) {
		return status === 502 || status === 503 || status === 504
	}

	function refreshRepeatedlyAfterTimeout() {
		onFileUploaded()
		setTimeout(onFileUploaded, 15_000)
		setTimeout(onFileUploaded, 45_000)
		setTimeout(onFileUploaded, 120_000)
	}

	async function handleUpload() {
		if (!fileInput.files || fileInput.files.length === 0) return

		uploading = true
		uploadError = null
		uploadNotice = null
		try {
			const formData = new FormData()
			for (let i = 0; i < fileInput.files.length; i++) {
				formData.append("files[]", fileInput.files[i] as File)
			}
			const res = await api.uploadFile(storeId, formData, normalizeChuncks, useOcr)
			if (res.ok) {
				onFileUploaded()
				return
			}
			if (isGatewayTimeout(res.status)) {
				uploadNotice = "Fikk ikke svar fra datakilden i tide. Se statuskolonnen i filisten under for å følge med på om opplastingen fullføres."
				refreshRepeatedlyAfterTimeout()
				return
			}
			uploadError = res.status === 415 ? "Filtypen støttes ikke av datakilden" : `Opplasting feilet (${res.status})`
		} catch {
			// Nettverksfeil, f.eks. at forbindelsen ble brutt av en proxy/gateway. Samme
			// resonnement som over: vi vet ikke utfallet, så vi sjekker status i stedet.
			uploadNotice = "Fikk ikke svar fra datakilden i tide. Se statuskolonnen i filisten under for å følge med på om opplastingen fullføres."
			refreshRepeatedlyAfterTimeout()
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
	<label>
		OCR
		<select bind:value={useOcr}>
			<option value="auto">Auto</option>
			<option value="true">Ja</option>
			<option value="false">Nei</option>
		</select>
	</label>
	<button type="submit" class="filled" disabled={uploading}>
		{uploading ? "Laster opp..." : "Last opp"}
	</button>
</form>

{#if uploadError}
	<p class="error">{uploadError}</p>
{/if}

{#if uploadNotice}
	<p class="notice">{uploadNotice}</p>
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

	p.notice {
		opacity: 0.75;
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
