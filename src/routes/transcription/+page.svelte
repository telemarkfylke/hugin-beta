<script lang="ts">
	import { onDestroy, onMount } from "svelte"
	import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte"
	import IconSpinner from "$lib/components/IconSpinner.svelte"
	import type { TranscriptionJob } from "$lib/server/transcription/types"

	const { data } = $props()

	const userId = $derived(data.authenticatedUser.userId)

	const MAX_FILE_SIZE_MB = 500
	const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
	const ACCEPTED_EXTENSIONS = [".mp3", ".mp4", ".wav", ".m4a", ".ogg", ".webm", ".flac", ".mkv", ".avi", ".wma"]
	const ACCEPTED_MIME_TYPES = [
		"audio/mpeg",
		"audio/mp3",
		"audio/wav",
		"audio/x-wav",
		"audio/wave",
		"audio/mp4",
		"audio/x-m4a",
		"audio/ogg",
		"audio/webm",
		"audio/flac",
		"audio/x-ms-wma",
		"video/mp4",
		"video/webm",
		"video/x-matroska",
		"video/x-msvideo"
	]
	const ACCEPT_ATTR = [...ACCEPTED_EXTENSIONS, ...ACCEPTED_MIME_TYPES].join(",")

	// Client-side gate only (mock): upload and recording stay disabled until the user confirms the recording requirements.
	let confirmed = $state(false)
	let isLoading = $state(true)

	let mediaRecorder: MediaRecorder | undefined
	let audioChunks: Blob[] = []
	let audioBlob: Blob | undefined = $state()
	let audioUrl: string | undefined = $state()
	let selectedFileName: string | null = $state(null)
	let recording = $state(false)
	let timer = $state(0)
	let timerInterval: ReturnType<typeof setInterval> | undefined

	let fileInputEl: HTMLInputElement | undefined = $state()
	let fileError = $state("")
	let submitStatus: "idle" | "sending" | "sent" | "error" = $state("idle")
	let submitMessage = $state("")
	let uploadProgress: number | null = $state(null) // 0-100 while uploading, null otherwise
	let uploadedBytes: number = $state(0)
	let totalBytes: number = $state(0)

	let jobs: TranscriptionJob[] = $state([])
	let pollInterval: ReturnType<typeof setInterval> | undefined
	let deleteDialogShow = $state(false)
	let deleteDialogJob: TranscriptionJob | null = $state(null)
	let deleteErrors: Record<string, string> = $state({})

	const localStorageKey = $derived(`transcription_jobs_${userId}`)

	// The transcription text is never kept in the browser - only what the list needs (the document is in S3)
	const persistJobs = (list: TranscriptionJob[]) => {
		const slim = list.map(({ result: _result, ...j }) => j)
		localStorage.setItem(localStorageKey, JSON.stringify(slim))
	}

	const mergeJobs = (local: TranscriptionJob[], server: TranscriptionJob[]): TranscriptionJob[] => {
		const serverMap = new Map(server.map((j) => [j.id, j]))
		const merged = local.map((j) => serverMap.get(j.id) ?? j)
		for (const j of server) {
			if (!merged.find((m) => m.id === j.id)) merged.unshift(j)
		}
		return merged
	}

	const formatTimer = (seconds: number) => {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, "0")
		const s = (seconds % 60).toString().padStart(2, "0")
		return `${m}:${s}`
	}

	const formatDateTime = (iso: string) => {
		try {
			return new Date(iso).toLocaleString("nb-NO")
		} catch {
			return iso
		}
	}

	const RETENTION_DAYS = 14

	// Display only (mock): the date the transcription is expected to be deleted.
	const formatDeleteDate = (iso: string) => {
		const date = new Date(iso)
		if (Number.isNaN(date.getTime())) return ""
		date.setDate(date.getDate() + RETENTION_DAYS)
		return date.toLocaleDateString("nb-NO")
	}

	type Mark = "yes" | "no"
	type RecordingOption = { name: string; description: string; icon: string; content: [Mark, Mark]; format: [Mark, Mark, Mark] }

	// "Krav til opptak": content = [ikke-sensitivt, sensitivt], format = [fysisk, Teams, hybrid]
	const RECORDING_OPTIONS: RecordingOption[] = [
		{ name: "Opptak i Hugin", description: "Opptaksknappen på denne siden", icon: "mic", content: ["yes", "yes"], format: ["yes", "no", "no"] },
		{ name: "OBS Studio", description: "Romlyd og systemlyd", icon: "radio_button_checked", content: ["yes", "yes"], format: ["yes", "yes", "yes"] },
		{ name: "Teams-opptak", description: "Innebygd opptak i Teams", icon: "videocam", content: ["yes", "no"], format: ["no", "yes", "no"] },
		{ name: "Mobil og andre apper", description: "Diktafon, opptaksapper o.l. – ikke tillatt", icon: "smartphone", content: ["no", "no"], format: ["no", "no", "no"] }
	]

	// Placeholder links until the real guide pages exist
	const OBS_GUIDE_URL = "#"
	const READ_MORE_URL = "#"

	const hasActiveJobs = () => jobs.some((j) => j.status === "uploading" || j.status === "processing")

	// null when the server could not be reached, so callers can tell "no jobs" from "unknown"
	const fetchServerJobs = async (): Promise<TranscriptionJob[] | null> => {
		try {
			const res = await fetch("/api/transcription")
			if (!res.ok) return null
			const body = (await res.json()) as { jobs?: TranscriptionJob[] }
			return body.jobs ?? []
		} catch {
			return null
		}
	}

	const refreshJobs = async () => {
		const serverJobs = await fetchServerJobs()
		if (!serverJobs) return
		jobs = mergeJobs(jobs, serverJobs)
		persistJobs(jobs)

		if (!hasActiveJobs() && pollInterval) {
			clearInterval(pollInterval)
			pollInterval = undefined
		}
	}

	const ensurePolling = () => {
		if (!pollInterval) {
			pollInterval = setInterval(refreshJobs, 5000)
		}
	}

	onMount(async () => {
		// Load and prune localStorage (30-day retention)
		const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
		let localJobs: TranscriptionJob[] = []
		try {
			const raw = localStorage.getItem(localStorageKey)
			if (raw) localJobs = (JSON.parse(raw) as TranscriptionJob[]).filter((j) => j.createdAt > cutoff)
		} catch {
			/* ignore parse errors */
		}

		const serverJobs = await fetchServerJobs()

		// Mark stale active jobs as failed (server restarted mid-job) - only when we actually heard from the server
		if (serverJobs) {
			const serverIds = new Set(serverJobs.map((j) => j.id))
			for (const j of localJobs) {
				if ((j.status === "uploading" || j.status === "processing") && !serverIds.has(j.id)) {
					j.status = "failed"
					j.error = "Serveren ble restartet under behandling"
				}
			}
		}

		jobs = mergeJobs(localJobs, serverJobs ?? [])
		persistJobs(jobs)

		if (hasActiveJobs()) ensurePolling()
		isLoading = false
	})

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval)
		if (timerInterval) clearInterval(timerInterval)
		// Leaving the page mid-recording must release the microphone
		if (mediaRecorder && mediaRecorder.state !== "inactive") {
			mediaRecorder.onstop = null
			mediaRecorder.stop()
		}
		for (const track of mediaRecorder?.stream.getTracks() ?? []) track.stop()
		if (audioUrl) URL.revokeObjectURL(audioUrl)
	})

	// Swaps the previewed audio, releasing the previous object URL so repeated picks/recordings don't leak memory
	const setPreview = (blob: Blob, fileName: string) => {
		if (audioUrl) URL.revokeObjectURL(audioUrl)
		selectedFileName = fileName
		audioBlob = blob
		audioUrl = URL.createObjectURL(blob)
	}

	const openDeleteDialog = (job: TranscriptionJob) => {
		deleteDialogJob = job
		deleteDialogShow = true
	}

	const confirmDelete = async () => {
		const job = deleteDialogJob
		if (!job) return
		const res = await fetch("/api/transcription", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: job.id })
		})
		if (res.ok) {
			jobs = jobs.filter((j) => j.id !== job.id)
			persistJobs(jobs)
			const { [job.id]: _, ...rest } = deleteErrors
			deleteErrors = rest
		} else {
			const body = await res.json().catch(() => ({}))
			deleteErrors = { ...deleteErrors, [job.id]: body.message ?? "Kunne ikke slette jobben" }
		}
		deleteDialogJob = null
	}

	async function startRecording() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			mediaRecorder = new MediaRecorder(stream)

			mediaRecorder.ondataavailable = (event) => {
				audioChunks.push(event.data)
			}

			mediaRecorder.onstop = () => {
				setPreview(new Blob(audioChunks, { type: "audio/webm" }), `opptak-${Date.now()}.webm`)
				audioChunks = []
				if (timerInterval) clearInterval(timerInterval)
				timer = 0
			}

			mediaRecorder.start()
			recording = true
			submitStatus = "idle"
			submitMessage = ""
			timerInterval = setInterval(() => {
				timer += 1
			}, 1000)
		} catch (err) {
			fileError = `Kunne ikke starte opptak: ${(err as Error).message}`
		}
	}

	function stopRecording() {
		if (!mediaRecorder) return
		mediaRecorder.stop()
		recording = false
		for (const track of mediaRecorder.stream.getTracks()) {
			track.stop()
		}
	}

	const handleAudioFileSelect = (event: Event) => {
		fileError = ""
		submitStatus = "idle"
		submitMessage = ""
		const input = event.target as HTMLInputElement
		const selectedFile = input.files?.[0]
		if (!selectedFile) return

		if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
			fileError = `Filen er for stor. Maks størrelse er ${MAX_FILE_SIZE_MB} MB.`
			input.value = ""
			return
		}

		const lowerName = selectedFile.name.toLowerCase()
		const hasValidExt = ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
		if (!hasValidExt) {
			fileError = `Filtype støttes ikke. Tillatte formater: ${ACCEPTED_EXTENSIONS.join(", ")}.`
			input.value = ""
			return
		}

		setPreview(selectedFile, selectedFile.name) // File extends Blob — no copy needed
	}

	const xhrPut = (url: string, blob: Blob): Promise<number> =>
		new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest()
			xhr.open("PUT", url)
			xhr.setRequestHeader("Content-Type", "application/octet-stream")
			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) {
					uploadedBytes = e.loaded
					totalBytes = e.total
					uploadProgress = Math.round((e.loaded / e.total) * 100)
				}
			}
			xhr.onload = () => resolve(xhr.status)
			xhr.onerror = () => reject(new Error("Nettverksfeil under opplasting"))
			xhr.onabort = () => reject(new Error("Opplastingen ble avbrutt"))
			xhr.send(blob)
		})

	const sendTilTranscript = async () => {
		if (!audioBlob || !selectedFileName) return
		submitStatus = "sending"
		submitMessage = ""
		uploadProgress = 0
		uploadedBytes = 0
		totalBytes = audioBlob.size

		let localJobId: string | undefined
		try {
			const createRes = await fetch("/api/transcription", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fileName: selectedFileName })
			})
			if (!createRes.ok) {
				const err = await createRes.json().catch(() => ({}))
				throw new Error(err.message || `Kunne ikke opprette jobb (${createRes.status})`)
			}
			const created = (await createRes.json()) as { job: TranscriptionJob }
			localJobId = created.job.id
			await refreshJobs()

			const uploadUrl = `/api/transcription/upload/${encodeURIComponent(userId)}/${encodeURIComponent(localJobId)}/${encodeURIComponent(selectedFileName)}`
			const status = await xhrPut(uploadUrl, audioBlob)
			uploadProgress = null
			if (status !== 200 && status !== 201 && status !== 204) {
				throw new Error(`Opplasting feilet (${status})`)
			}

			const patchRes = await fetch("/api/transcription", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: localJobId, status: "processing" })
			})
			if (!patchRes.ok) {
				const err = await patchRes.json().catch(() => ({}))
				throw new Error(err.message || `Kunne ikke starte transkripsjon (${patchRes.status})`)
			}

			submitStatus = "sent"
			submitMessage = "Filen er lastet opp. Transkripsjonen kjører nå – resultatet vises i listen under når den er ferdig."
			await refreshJobs()
			ensurePolling()
		} catch (error) {
			uploadProgress = null
			submitStatus = "error"
			submitMessage = `Noe gikk galt: ${(error as Error).message}`
		}
	}
</script>

{#snippet markIcon(mark: Mark)}
	{#if mark === "yes"}
		<span class="mark mark-yes" role="img" aria-label="Tillatt"><span class="material-symbols-outlined">check</span></span>
	{:else}
		<span class="mark mark-no" role="img" aria-label="Ikke tillatt"><span class="material-symbols-outlined">close</span></span>
	{/if}
{/snippet}

{#if isLoading}
	<div class="loading">
		<IconSpinner width="32px" />
	</div>
{:else}
	<div class="transcription-page">
		<h1>Tale til notat</h1>
		<h3 class="subtitle">
			En selvbetjeningsløsning for transkripsjon av tale med
			<a href="https://www.nb.no/pressemeldinger/nasjonalbiblioteket-deler-kunstig-intelligens-som-skjoner-norske-dialekter-og-gjer-tale-om-til-tekst/" target="_blank" rel="noopener noreferrer">norsktrent språkmodell</a>
		</h3>
		<p class="lead">Spill inn eller last opp lyd. Filen lastes opp, og resultatet dukker opp i listen under når transkripsjonen er ferdig.</p>

		<section class="local-box" aria-labelledby="local-title">
			<span class="material-symbols-outlined">dns</span>
			<div>
				<h2 id="local-title">Behandles lokalt i Telemark fylkeskommune</h2>
				<p>
					Lydfiler og transkripsjoner som behandles på denne siden behandles på fylkeskommunens egne servere og sendes ikke til eksterne skytjenester. Løsningen er vurdert som trygg
					for personopplysninger og annen sensitiv informasjon – når kravene til opptak under er fulgt.
				</p>
			</div>
		</section>

		<section class="card requirements" aria-labelledby="requirements-title">
			<h2 id="requirements-title" class="card-title">
				<span class="material-symbols-outlined">verified_user</span>
				Krav til opptak
			</h2>
			<div class="table-scroll">
				<table class="requirements-table">
					<thead>
						<tr class="group-row">
							<th scope="col" rowspan="2" class="option-head">Opptaksløsning</th>
							<th scope="colgroup" colspan="2" class="group-head content-group">Innhold</th>
							<th scope="colgroup" colspan="3" class="group-head format-group">Møteformat</th>
						</tr>
						<tr>
							<th scope="col" class="col-head col-open">Ikke-sensitivt</th>
							<th scope="col" class="col-head col-sensitive">Sensitivt</th>
							<th scope="col" class="col-head format-group">Fysisk møte</th>
							<th scope="col" class="col-head format-group">Teams-møte</th>
							<th scope="col" class="col-head format-group">Hybridmøte</th>
						</tr>
					</thead>
					<tbody>
						{#each RECORDING_OPTIONS as option (option.name)}
							<tr>
								<th scope="row" class="option-cell">
									<span class="material-symbols-outlined">{option.icon}</span>
									<span>
										<span class="option-name">{option.name}</span>
										<span class="option-description">{option.description}</span>
									</span>
								</th>
								<td class="mark-cell col-open">{@render markIcon(option.content[0])}</td>
								<td class="mark-cell col-sensitive">{@render markIcon(option.content[1])}</td>
								{#each option.format as mark, i (i)}
									<td class="mark-cell format-group">{@render markIcon(mark)}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="small"><strong>Slik leser du tabellen:</strong> Løsningen må ha hake både for innholdet og for møteformatet.</p>
			<p class="small">
				Mobilens diktafon og andre opptaksapper skal ikke brukes. Teams-opptak kan kun brukes for å gjøre lydopptak av møter uten sensitiv informasjon. Dette er for å unngå at lydopptak
				med sensitiv informasjon synkes til OneDrive, iCloud eller andre skyløsninger.
			</p>
			<p class="small">
				I Teams- og hybridmøter tar OBS Studio opp både romlyd og systemlyd, slik at deltakere på nett også kommer med.
				<a href={OBS_GUIDE_URL}>Slik setter du opp OBS Studio</a>
			</p>
		</section>

		<section class="never-box" aria-labelledby="never-title">
			<h2 id="never-title">
				<span class="material-symbols-outlined">block</span>
				Noe egner seg aldri for opptak
			</h2>
			<p>
				Selv om løsningen er trygg, finnes det informasjon som ikke skal tas opp. Det er leder for hvert fagmiljø som vurderer om innholdet i et møte egner seg for opptak. Er du usikker,
				avklar med leder før du starter. Last aldri opp opptak av elever. Husk også å vurdere potensiell nedkjølingseffekt og skjev maktbalanse ved opptak.
				<a href={READ_MORE_URL}>Les mer om dette her.</a>
			</p>
		</section>

		<section class="confirm-box">
			<label class="confirm-label">
				<input type="checkbox" bind:checked={confirmed} />
				<span>
					<strong>Jeg bekrefter</strong> at innholdet egner seg for opptak, at alle parter er informert, og at sensitiv informasjon kun er tatt opp med Hugin eller OBS Studio.
				</span>
			</label>
			<details class="privacy">
				<summary>Personvernerklæring</summary>
				<p class="placeholder">[Tekst fra eksisterende personvernerklæring]</p>
			</details>
		</section>

		<div class="action-grid" class:locked={!confirmed}>
			<section class="action-card" aria-labelledby="upload-title">
				<h2 id="upload-title" class="card-title">
					<span class="material-symbols-outlined">upload</span>
					Last opp en fil
				</h2>
				<p class="action-description">
					Sensitive opptak må være gjort med OBS Studio. Filer på maks {MAX_FILE_SIZE_MB} MB. Støttede filtyper: {ACCEPTED_EXTENSIONS.join(", ")}.
				</p>
				<p class="action-description"><strong>Husk</strong> å slette filen fra enheten din etter opplasting.</p>

				<div class="file-input-row">
					<button type="button" class="filled" onclick={() => fileInputEl?.click()} disabled={!confirmed || recording}>
						<span class="material-symbols-outlined">folder_open</span>
						Velg fil
					</button>
					<span class="file-name">{selectedFileName ?? "Ingen fil er valgt"}</span>
					<input bind:this={fileInputEl} type="file" accept={ACCEPT_ATTR} id="audioFile" name="audioFile" onchange={handleAudioFileSelect} disabled={!confirmed} hidden />
				</div>
				{#if fileError}
					<p class="error-text">{fileError}</p>
				{/if}
			</section>

			<section class="action-card" aria-labelledby="record-title">
				<h2 id="record-title" class="card-title">
					<span class="material-symbols-outlined">mic</span>
					…eller spill inn lyd her
				</h2>
				<p class="action-description">Godkjent for sensitiv informasjon. Egner seg for fysiske møter og samtaler – tar kun opp lyd fra mikrofonen.</p>

				<button
					type="button"
					class="filled record-button"
					class:danger={recording}
					onclick={recording ? stopRecording : startRecording}
					disabled={!confirmed && !recording}
				>
					<span class="material-symbols-outlined">{recording ? "stop" : "radio_button_unchecked"}</span>
					{recording ? "Stopp opptak" : "Start opptak"}
				</button>

				{#if recording}
					<p class="recording-indicator">
						<span class="pulse"></span>
						Opptak pågår: {formatTimer(timer)}
					</p>
				{/if}
			</section>
		</div>
		{#if !confirmed}
			<p class="confirm-hint">Kryss av for bekreftelsen over for å laste opp eller starte opptak.</p>
		{/if}

		{#if audioUrl && !recording}
			<section class="action-card preview-card" aria-label="Forhåndsvisning">
				<h2 class="card-title">
					<span class="material-symbols-outlined">play_circle</span>
					Forhåndsvisning
				</h2>
				<audio controls src={audioUrl}></audio>
				<div class="preview-actions">
					<button type="button" class="filled" onclick={sendTilTranscript} disabled={!confirmed || submitStatus === "sending" || submitStatus === "sent"}>
						<span class="material-symbols-outlined">send</span>
						{submitStatus === "sending" ? "Laster opp…" : submitStatus === "sent" ? "Sendt" : "Send til transkripsjon"}
					</button>
					<a href={audioUrl} download={selectedFileName || "opptak.webm"} class="outline-button">
						<span class="material-symbols-outlined">download</span>
						Last ned opptak
					</a>
				</div>
				{#if uploadProgress !== null}
					<div class="upload-progress" aria-label="Opplastingsstatus">
						<div class="upload-progress-bar" style="width: {uploadProgress}%"></div>
					</div>
					<p class="upload-progress-label">
						{uploadProgress}% — {(uploadedBytes / 1024 / 1024).toFixed(1)} / {(totalBytes / 1024 / 1024).toFixed(1)} MB
					</p>
				{/if}
				{#if submitMessage}
					<p class:error-text={submitStatus === "error"} class:success-text={submitStatus === "sent"}>
						{submitMessage}
					</p>
				{/if}
			</section>
		{/if}

		<section class="jobs-card" aria-labelledby="jobs-title">
			<h2 id="jobs-title" class="card-title">
				<span class="material-symbols-outlined">history</span>
				Mine transkripsjoner
			</h2>
			<p class="small">Transkripsjonene lagres i to uker og slettes deretter automatisk. Bearbeid transkripsjonen før fristen.</p>
			{#if jobs.length === 0}
				<p class="jobs-empty">Ingen transkripsjoner ennå.</p>
			{:else}
				<ul class="jobs-list">
					{#each jobs as job (job.id)}
						<li class="job-item" class:failed={job.status === "failed"}>
							<div class="job-main">
								<div class="job-header">
									<span class="job-name">{job.fileName}</span>
									<span class="job-status status-{job.status}">
										{#if job.status === "uploading"}Laster opp
										{:else if job.status === "processing"}Behandles
										{:else if job.status === "completed"}Ferdig
										{:else}Feilet
										{/if}
									</span>
								</div>
								<div class="job-meta">
									Opprettet: {formatDateTime(job.createdAt)}
									{#if job.durationSeconds != null}
										· Varighet: {job.durationSeconds.toFixed(1)} s
									{/if}
									· Slettes {formatDeleteDate(job.createdAt)}
								</div>
								{#if job.status === "failed" && job.error}
									<p class="error-text">{job.error}</p>
								{/if}
								{#if deleteErrors[job.id]}
									<p class="error-text">{deleteErrors[job.id]}</p>
								{/if}
							</div>
							<div class="job-actions">
								{#if job.status === "completed" && job.hasDocx}
									<!-- Mock: "Åpne" downloads the Word document until we decide what it should do -->
									<a class="outline-button" href={`/api/transcription/${job.id}/download`}>
										<span class="material-symbols-outlined">open_in_new</span>
										Åpne
									</a>
								{/if}
								<button type="button" class="job-delete" aria-label={`Slett ${job.fileName}`} onclick={() => openDeleteDialog(job)}>
									<span class="material-symbols-outlined">delete</span>
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="card remember" aria-labelledby="remember-title">
			<h2 id="remember-title">Husk også</h2>
			<ul>
				<li>Alle parter må informeres før opptak starter.</li>
				<li>Transkripsjoner kan inneholde feil – kvalitetssikre alltid resultatet.</li>
				<li>Slett lydfilen fra enheten etter opplasting.</li>
				<li>Tjenesten er under utvikling og kan være ustabil.</li>
			</ul>
		</section>
		<p class="model-info">Språkmodell: Nasjonalbibliotekets nb-whisper-medium</p>
	</div>
{/if}

<ConfirmDeleteDialog
	bind:show={deleteDialogShow}
	message={`Er du sikker på at du vil slette "${deleteDialogJob?.fileName ?? ""}"?`}
	subtext="Lydfilen og eventuelle dokumenter vil bli slettet fra serveren."
	onConfirm={confirmDelete}
/>

<style>
	.transcription-page {
		--ttn-ok: #1b7a4f;
		--ttn-ok-bg: color-mix(in srgb, var(--ttn-ok) 12%, transparent);
		--ttn-ok-border: color-mix(in srgb, var(--ttn-ok) 35%, transparent);
		--ttn-danger-bg: color-mix(in srgb, var(--color-danger) 9%, transparent);
		--ttn-danger-border: color-mix(in srgb, var(--color-danger) 35%, transparent);
		--ttn-format-bg: color-mix(in srgb, var(--color-primary) 10%, transparent);
		max-width: 900px;
		margin: 0 auto;
		padding: 1rem 1.25rem 3rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	h1 {
		color: var(--color-primary);
		margin: 0;
	}

	.subtitle {
		margin: -0.75rem 0 0;
	}

	.lead {
		color: var(--color-primary-80);
		margin: -0.75rem 0 0;
	}

	.loading {
		display: flex;
		justify-content: center;
		padding: 3rem;
	}

	.small {
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--color-primary-80);
		margin: 0.5rem 0 0;
	}

	.card {
		border: 1px solid var(--color-primary-20);
		border-radius: 8px;
		padding: 1.25rem;
	}

	.card-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
		color: var(--color-primary);
	}

	/* Behandles lokalt */
	.local-box {
		display: flex;
		gap: 0.75rem;
		background-color: var(--ttn-ok-bg);
		border: 1px solid var(--ttn-ok-border);
		border-radius: 8px;
		padding: 1rem 1.25rem;
		color: var(--color-primary);
	}

	.local-box h2 {
		font-size: 1rem;
		margin: 0 0 0.25rem;
	}

	.local-box p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	/* Krav til opptak */
	.table-scroll {
		overflow-x: auto;
		border: 1px solid var(--color-primary-20);
		border-radius: 6px;
	}

	.requirements-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.requirements-table th,
	.requirements-table td {
		padding: 0.6rem 0.5rem;
		border-bottom: 1px solid var(--color-primary-10);
	}

	.requirements-table tbody tr:last-child th,
	.requirements-table tbody tr:last-child td {
		border-bottom: none;
	}

	.option-head {
		text-align: left;
		font-size: 0.95rem;
		color: var(--color-primary);
		background-color: var(--color-primary-10);
	}

	.group-head {
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-primary-80);
	}

	.content-group {
		background-color: var(--color-primary-10);
	}

	.col-head {
		font-weight: 600;
		white-space: nowrap;
	}

	.col-open {
		background-color: var(--ttn-ok-bg);
		color: var(--ttn-ok);
	}

	.col-sensitive {
		background-color: var(--ttn-danger-bg);
		color: var(--color-danger);
	}

	.format-group {
		background-color: var(--ttn-format-bg);
		color: var(--color-primary);
	}

	.option-cell {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		text-align: left;
		font-weight: normal;
		min-width: 13rem;
	}

	.option-cell .material-symbols-outlined {
		font-size: 1.15rem;
		color: var(--color-primary);
	}

	.option-name {
		display: block;
		font-weight: 600;
		color: var(--color-primary);
	}

	.option-description {
		display: block;
		font-size: 0.78rem;
		color: var(--color-primary-80);
	}

	.mark-cell {
		text-align: center;
	}

	.mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		color: white;
	}

	.mark .material-symbols-outlined {
		font-size: 1rem;
		font-weight: 700;
	}

	.mark-yes {
		background-color: var(--ttn-ok);
	}

	.mark-no {
		background-color: var(--color-danger);
	}

	/* Noe egner seg aldri */
	.never-box {
		background-color: var(--ttn-danger-bg);
		border: 1px solid var(--ttn-danger-border);
		border-radius: 8px;
		padding: 1rem 1.25rem;
		color: var(--color-danger);
	}

	.never-box h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.1rem;
		margin: 0 0 0.4rem;
	}

	.never-box p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.never-box a {
		color: inherit;
		font-weight: 700;
	}

	/* Bekreftelse */
	.confirm-box {
		background-color: var(--color-primary-10);
		border-radius: 8px;
		padding: 1rem 1.25rem;
	}

	.confirm-label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		cursor: pointer;
		line-height: 1.45;
	}

	.confirm-label input {
		width: 1.15rem;
		height: 1.15rem;
		margin-top: 0.15rem;
		flex-shrink: 0;
		accent-color: var(--color-primary);
	}

	.privacy {
		margin-top: 0.75rem;
	}

	.privacy summary {
		cursor: pointer;
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--color-primary);
	}

	.placeholder {
		font-style: italic;
		color: var(--color-primary-80);
		font-size: 0.9rem;
	}

	/* Opplasting og opptak */
	.action-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.action-card {
		background-color: var(--color-primary-10);
		border: 1px solid var(--color-primary-20);
		border-radius: 8px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.action-card .card-title {
		margin: 0;
	}

	.action-grid.locked .action-card {
		opacity: 0.6;
	}

	.action-description {
		margin: 0;
		font-size: 0.88rem;
		color: var(--color-primary-80);
		line-height: 1.45;
	}

	/* Design: buttons stay visibly "filled" but muted while locked */
	.action-card button.filled:disabled {
		background-color: var(--color-primary-70);
		color: white;
		opacity: 0.75;
		cursor: not-allowed;
	}

	.record-button {
		margin-top: auto;
		width: 100%;
		justify-content: center;
	}

	.confirm-hint {
		text-align: center;
		font-size: 0.85rem;
		color: var(--color-primary-80);
		margin: -0.5rem 0 0;
	}

	.file-input-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: auto;
	}

	.file-name {
		font-size: 0.85rem;
		color: var(--color-primary-80);
		font-style: italic;
	}

	.error-text {
		color: var(--color-danger);
		font-size: 0.85rem;
		margin: 0.25rem 0 0;
	}

	.success-text {
		color: var(--color-primary);
		font-size: 0.9rem;
		font-weight: 600;
		margin: 0.5rem 0 0;
	}

	.recording-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-danger);
		font-weight: 600;
		margin: 0;
	}

	.pulse {
		width: 0.75rem;
		height: 0.75rem;
		background-color: var(--color-danger);
		border-radius: 50%;
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.4;
			transform: scale(0.85);
		}
	}

	.preview-card audio {
		width: 100%;
	}

	.preview-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.upload-progress {
		height: 6px;
		background-color: var(--color-primary-20);
		border-radius: 999px;
		overflow: hidden;
	}

	.upload-progress-bar {
		height: 100%;
		background-color: var(--color-primary);
		border-radius: 999px;
		transition: width 0.2s ease;
	}

	.upload-progress-label {
		font-size: 0.8rem;
		color: var(--color-primary-80);
		margin: 0;
	}

	.outline-button {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 2.25rem;
		padding: 0 0.85rem;
		border: 2px solid var(--color-primary);
		border-radius: 6px;
		color: var(--color-primary);
		text-decoration: none;
		font-family: var(--font-family);
		font-weight: 600;
		white-space: nowrap;
	}

	.outline-button:hover {
		background-color: var(--color-primary-20);
		color: var(--color-primary);
	}

	/* Mine transkripsjoner */
	.jobs-card {
		background-color: var(--color-primary-10);
		border-radius: 8px;
		padding: 1.25rem;
	}

	.jobs-card .card-title {
		margin-bottom: 0;
	}

	.jobs-card > .small {
		margin: 0.25rem 0 0.75rem;
	}

	.jobs-empty {
		margin: 0;
		color: var(--color-primary-80);
		font-style: italic;
		font-size: 0.9rem;
	}

	.jobs-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.job-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		background-color: var(--color-background, white);
		border: 1px solid var(--color-primary-20);
		border-radius: 6px;
		padding: 0.75rem 1rem;
	}

	.job-item.failed {
		border-left: 4px solid var(--color-danger);
	}

	.job-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.job-name {
		font-weight: 700;
		color: var(--color-primary);
		word-break: break-word;
	}

	.job-status {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		background-color: var(--color-secondary-20);
		color: var(--color-primary);
	}

	.job-status.status-completed {
		background-color: var(--color-primary);
		color: white;
	}

	.job-status.status-failed {
		background-color: var(--color-danger);
		color: white;
	}

	.job-meta {
		font-size: 0.8rem;
		color: var(--color-primary-80);
		margin-top: 0.25rem;
	}

	.job-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.job-delete {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-primary);
		padding: 0.25rem;
		line-height: 1;
		display: flex;
		align-items: center;
	}

	.job-delete:hover {
		color: var(--color-danger);
	}

	.job-delete .material-symbols-outlined {
		font-size: 1.2rem;
	}

	/* Husk også */
	.remember h2 {
		font-size: 1rem;
		margin: 0 0 0.5rem;
		color: var(--color-primary);
	}

	.remember ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.remember li {
		font-size: 0.88rem;
		line-height: 1.5;
		color: var(--color-primary-80);
	}

	.model-info {
		font-size: 0.8rem;
		color: var(--color-primary-80);
		margin: 0;
	}

	@media (max-width: 768px) {
		.action-grid {
			grid-template-columns: 1fr;
		}

		.transcription-page {
			padding: 0.75rem;
		}

		.job-item {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
