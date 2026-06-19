<script lang="ts">
	import { onDestroy, onMount } from "svelte"
	import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte"
	import IconSpinner from "$lib/components/IconSpinner.svelte"
	import InfoBox from "$lib/components/InfoBox.svelte"
	import type { TranscriptionJob } from "$lib/server/transcription/types"

	type TranscriptionMode = "open" | "red"

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

	const { VITE_MOCK_API: mockApi } = import.meta.env

	let selectedMode: TranscriptionMode = $state("open")
	let modeConfirmed = $state(false)
	let redPanelOpen = $state(false) // whether the red sub-panel is visible
	let selectedRedIndex: number | null = $state(null) // index into availableRedGroups
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

	const availableRedGroups = $derived(data.APP_CONFIG.TRANSCRIPTION_GROUPS.filter((g) => data.authenticatedUser.groups.includes(g.id)))

	const hasAnyRedAccess = $derived(availableRedGroups.length > 0)

	const isRedMode = $derived(selectedMode !== "open")

	const persistJobs = (list: TranscriptionJob[]) => {
		const slim = list.map((j) => ({
			...j,
			result: j.result ? { docx_url: j.result.docx_url ?? null } : null
		}))
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

	const hasActiveJobs = () => jobs.some((j) => j.status === "uploading" || j.status === "processing")

	const refreshJobs = async () => {
		try {
			const res = await fetch("/api/transcription")
			if (!res.ok) return
			const body = (await res.json()) as { jobs: TranscriptionJob[] }
			jobs = mergeJobs(jobs, body.jobs ?? [])
			persistJobs(jobs)

			if (!hasActiveJobs() && pollInterval) {
				clearInterval(pollInterval)
				pollInterval = undefined
			}
		} catch {
			// ignore polling errors
		}
	}

	const ensurePolling = () => {
		if (!pollInterval) {
			pollInterval = setInterval(refreshJobs, 5000)
		}
	}

	onMount(async () => {
		if (mockApi && mockApi === "true") {
			await new Promise((resolve) => setTimeout(resolve, 500))
		}

		// Load and prune localStorage (30-day retention)
		const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
		let localJobs: TranscriptionJob[] = []
		try {
			const raw = localStorage.getItem(localStorageKey)
			if (raw) localJobs = (JSON.parse(raw) as TranscriptionJob[]).filter((j) => j.createdAt > cutoff)
		} catch {
			/* ignore parse errors */
		}

		// Fetch server state
		let serverJobs: TranscriptionJob[] = []
		try {
			const res = await fetch("/api/transcription")
			if (res.ok) {
				const body = (await res.json()) as { jobs: TranscriptionJob[] }
				serverJobs = body.jobs ?? []
			}
		} catch {
			/* ignore */
		}

		// Mark stale active jobs as failed (server restarted mid-job)
		const serverIds = new Set(serverJobs.map((j) => j.id))
		for (const j of localJobs) {
			if ((j.status === "uploading" || j.status === "processing") && !serverIds.has(j.id)) {
				j.status = "failed"
				j.error = "Serveren ble restartet under behandling"
			}
		}

		jobs = mergeJobs(localJobs, serverJobs)
		persistJobs(jobs)

		if (hasActiveJobs()) {
			pollInterval = setInterval(refreshJobs, 5000)
		}
		isLoading = false
	})

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval)
	})

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
			body: JSON.stringify({ id: job.id, fileName: job.fileName, audioUrl: job.audioUrl ?? null, docxUrl: job.result?.docx_url ?? null })
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

	const selectMode = (mode: "open" | "red") => {
		if (mode === "open") {
			selectedMode = "open"
			modeConfirmed = true
			redPanelOpen = false
			selectedRedIndex = null
		} else {
			redPanelOpen = true
			modeConfirmed = false
		}
	}

	const selectRedUseCase = (index: number) => {
		selectedRedIndex = index
		selectedMode = "red"
		modeConfirmed = true
		// Reset any previous audio state
		audioBlob = undefined
		audioUrl = undefined
		selectedFileName = null
		submitStatus = "idle"
		submitMessage = ""
		fileError = ""
	}

	async function startRecording() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			mediaRecorder = new MediaRecorder(stream)

			mediaRecorder.ondataavailable = (event) => {
				audioChunks.push(event.data)
			}

			mediaRecorder.onstop = () => {
				selectedFileName = `opptak-${Date.now()}.webm`
				audioBlob = new Blob(audioChunks, { type: "audio/webm" })
				audioUrl = URL.createObjectURL(audioBlob)
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

		selectedFileName = selectedFile.name
		audioBlob = selectedFile // File extends Blob — no copy needed
		audioUrl = URL.createObjectURL(selectedFile)
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

{#if isLoading}
	<div class="loading">
		<IconSpinner width="32px" />
	</div>
{:else}
	<div class="transcription-page">
		<h1>Tale til notat</h1>
		<h3>En selvbetjeningsløsning for transkripsjon av tale med <a href="https://www.nb.no/pressemeldinger/nasjonalbiblioteket-deler-kunstig-intelligens-som-skjoner-norske-dialekter-og-gjer-tale-om-til-tekst/" target="_blank" rel="noopener noreferrer">norsktrent språkmodell</a></h3>
		<p class="lead">
			Spill inn eller last opp lyd. Filen lastes opp og resultatet dukker opp i listen under når transkripsjonen er ferdig.
		</p>

		<div class="mode-grid" role="radiogroup" aria-label="Velg transkripsjonsmodus">
			<button
				type="button"
				class="mode-card open"
				class:selected={selectedMode === "open" && modeConfirmed}
				role="radio"
				aria-checked={selectedMode === "open"}
				onclick={() => selectMode("open")}
			>
				<div class="mode-header">
					<span class="material-symbols-outlined">lock_open</span>
					<h2>Åpen transkripsjon</h2>
				</div>
				<p class="mode-subtitle">Bruk denne hvis samtalen inneholder:</p>
				<ul>
					<li>Generelle saksopplysninger</li>
					<li>Ikke-sensitivt innhold</li>
				</ul>
				<p class="mode-detail">
					Det er mulig å laste opp en fil for transkripsjon eller gjøre opptak direkte i nettleseren.
				</p>
			</button>

			<button
				type="button"
				class="mode-card closed"
				class:selected={redPanelOpen}
				aria-expanded={redPanelOpen}
				onclick={() => selectMode("red")}
			>
				<div class="mode-header">
					<span class="material-symbols-outlined">lock</span>
					<h2>Lukket transkripsjon</h2>
				</div>
				<p class="mode-subtitle">Bruk denne hvis samtalen inneholder:</p>
				<ul>
					<li>Personopplysninger</li>
					<li>Helseopplysninger</li>
					<li>Andre sensitive opplysninger</li>
				</ul>
				<p class="mode-detail">
					Informasjonen behandles internt i Telemark fylkeskommune.
				</p>
			</button>
		</div>

		{#if redPanelOpen}
			<div class="red-panel" role="region" aria-label="Velg type sensitiv transkripsjon">
				<p class="red-panel-title">
					<span class="material-symbols-outlined">lock</span>
					Velg type sensitiv transkripsjon
				</p>
				{#if hasAnyRedAccess}
					{#each availableRedGroups as group, i}
						<button
							type="button"
							class="use-case-btn"
							class:active={selectedRedIndex === i}
							onclick={() => selectRedUseCase(i)}
						>
							{group.label}
							{#if selectedRedIndex === i}
								<span class="material-symbols-outlined use-case-check">check_circle</span>
							{/if}
						</button>
					{/each}
				{:else}
					<div class="no-access-box" role="alert">
						<span class="material-symbols-outlined">warning</span>
						Du har ikke tilgang til noen av de sensitive transkripsjonmodiene. Hvis innholdet er sensitivt eller taushetsbelagt, skal ikke tjenesten brukes.
					</div>
				{/if}
			</div>
		{/if}

		<InfoBox title="Personvernerklæring">
			<h2>Personvernerklæring – Hugin - tale til notat</h2>

			<h3>1. Formål</h3>
			<p>
				Hugin brukes til å gjøre muntlig tale om til skriftlige notater, og eventuelt sammendrag, ved hjelp av KI. Formålet er å effektivisere og kvalitetssikre referat- og notatføring.
			</p>
			<p>
				Opplysningene kommer fra lydopptak som brukeren enten laster opp eller tar opp direkte i løsningen. Opplysningene brukes kun til å lage og ferdigstille notatet.
			</p>
			<p>
				Opplysninger deles ikke med eksterne behandlingsansvarlige. Tekniske ressurser kan behandle opplysninger når det er nødvendig for å levere tjenesten.
			</p>

			<h3>2. Lovgrunnlag</h3>
			<p>
				Behandlingsgrunnlaget er samtykke, jf. personvernforordningen artikkel 6 nr. 1 bokstav a.
				Alle deltakere skal informeres og samtykke før opptak starter. Hvis noen ikke samtykker, skal Hugin ikke brukes.
				Løsningen skal ikke brukes til særlige kategorier personopplysninger etter artikkel 9, for eksempel helseopplysninger, dersom opplysningene kan knyttes til en identifiserbar person.
			</p>

			<h3>3. Kategorier personopplysninger</h3>
			<p>Det kan behandles:</p>
			<ul>
				<li>lydopptak</li>
				<li>transkribert tekst</li>
				<li>KI-generert sammendrag</li>
				<li>bruker-ID/brukernavn</li>
				<li>personopplysninger som blir sagt i opptaket</li>
			</ul>
			<p>Registrerte kan være ansatte, elever, studenter, møtedeltakere og personer som omtales i opptaket.</p>

			<h3>4. Sikkerhet</h3>
			<p>
				Løsningen er tilgangsstyrt. Bare innlogget bruker som har lastet opp eller gjort opptaket, får tilgang til lenke og dokument.
				Transkribering skjer på lokal server i sikret nettverk. KI-resultatet skal kontrolleres av et menneske før det brukes som ferdig dokumentasjon. KI-genererte dokumenter merkes som KI-generert.
			</p>

			<h3>5. Lagring og sletting</h3>
			<p>
				Lydopptak slettes umiddelbart etter transkribering.
				Transkribert dokument, sammendrag og nedlastningslenke lagres i Hugin/server i 14 dager, og slettes deretter automatisk.
				Hvis brukeren laster ned dokumentet, må brukeren selv sørge for riktig lagring og sletting videre.
			</p>
		</InfoBox>

		{#if modeConfirmed}
			{#if isRedMode && selectedRedIndex !== null}
				<p class="red-mode-label">
					<span class="material-symbols-outlined">lock</span>
					{availableRedGroups[selectedRedIndex]?.label ?? ""}
				</p>
			{/if}

			<div class="action-grid">
				<section class="action-card" class:action-card-red={isRedMode} aria-labelledby="upload-title">
					<h3 id="upload-title">
						<span class="material-symbols-outlined">upload_file</span>
						Last opp en lydfil
					</h3>
					<p class="action-description">
						Last opp lyd- eller videoklipp (maks {MAX_FILE_SIZE_MB} MB). Støttede formater: {ACCEPTED_EXTENSIONS.join(", ")}.
					</p>
					<p class="action-reminder">
						<strong>Husk</strong> å slette lydfilen fra enheten din etter opplasting.
					</p>

					<div class="file-input-row">
						<button
							type="button"
							class="filled"
							class:filled-red={isRedMode}
							onclick={() => fileInputEl?.click()}
							disabled={recording}
						>
							<span class="material-symbols-outlined">folder_open</span>
							Velg fil
						</button>
						<span class="file-name">
							{selectedFileName ?? "Ingen fil er valgt"}
						</span>
						<input
							bind:this={fileInputEl}
							type="file"
							accept={ACCEPT_ATTR}
							id="audioFile"
							name="audioFile"
							onchange={handleAudioFileSelect}
							hidden
						/>
					</div>
					{#if fileError}
						<p class="error-text">{fileError}</p>
					{/if}
				</section>

				<section class="action-card" class:action-card-red={isRedMode} aria-labelledby="record-title">
					<h3 id="record-title">
						<span class="material-symbols-outlined">mic</span>
						…eller spill inn lyd
					</h3>
					<div class="info-callout" class:info-callout-red={isRedMode}>
						<strong>NB!</strong> Husk å laste ned lydopptaket før du sender til transkribering
						i tilfelle noe går galt eller om du trenger en backup.
					</div>

					<button
						type="button"
						class="filled"
						class:filled-red={isRedMode}
						class:danger={recording}
						onclick={recording ? stopRecording : startRecording}
					>
						<span class="material-symbols-outlined">
							{recording ? "stop" : "fiber_manual_record"}
						</span>
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

			{#if audioUrl && !recording}
				<section class="preview-card" class:preview-card-red={isRedMode} aria-label="Forhåndsvisning">
					<h3>
						<span class="material-symbols-outlined">play_circle</span>
						Forhåndsvisning
					</h3>
					<audio controls src={audioUrl}></audio>
					<div class="preview-actions">
						<button
							type="button"
							class="filled"
							class:filled-red={isRedMode}
							onclick={sendTilTranscript}
							disabled={submitStatus === "sending" || submitStatus === "sent"}
						>
							<span class="material-symbols-outlined">send</span>
							{submitStatus === "sending" ? "Laster opp…" : submitStatus === "sent" ? "Sendt" : "Send til transkripsjon"}
						</button>
						<a href={audioUrl} download={selectedFileName || "opptak.webm"} class="download-button" class:download-button-red={isRedMode}>
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

			<section class="jobs-card" class:jobs-card-red={isRedMode} aria-label="Transkripsjoner">
				<h3>
					<span class="material-symbols-outlined">history</span>
					Mine transkripsjoner
				</h3>
				{#if jobs.length === 0}
					<p class="jobs-empty">Ingen transkripsjoner ennå.</p>
				{:else}
					<ul class="jobs-list">
						{#each jobs as job (job.id)}
							<li class="job-item" class:completed={job.status === "completed"} class:failed={job.status === "failed"}>
								<div class="job-header">
									<span class="job-name">{job.fileName}</span>
									<span class="job-status status-{job.status}">
										{#if job.status === "uploading"}Laster opp
										{:else if job.status === "processing"}Behandles
										{:else if job.status === "completed"}Ferdig
										{:else}Feilet
										{/if}
									</span>
									<button
										type="button"
										class="job-delete"
										aria-label="Slett jobb"
										onclick={() => openDeleteDialog(job)}
									>
										<span class="material-symbols-outlined">delete</span>
									</button>
								</div>
								<div class="job-meta">
									Opprettet: {formatDateTime(job.createdAt)}
									{#if job.durationSeconds != null}
										· Varighet: {job.durationSeconds.toFixed(1)} s
									{/if}
								</div>
								{#if job.status === "failed" && job.error}
									<p class="error-text">{job.error}</p>
								{/if}
								{#if job.status === "completed" && job.result}
									{#if job.result.docx_url}
										<div class="job-actions">
											<a class="download-button" href={`/api/transcription/${job.id}/download`}>
												<span class="material-symbols-outlined">description</span>
												Last ned Word-dokument
											</a>
										</div>
									{/if}
								{/if}
								{#if deleteErrors[job.id]}
									<p class="error-text">{deleteErrors[job.id]}</p>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="warning-panel" aria-label="Viktig informasjon">
				<h3>
					<span class="material-symbols-outlined">warning</span>
					Husk at:
				</h3>
				<ul>
					<li>Tjenesten er under utvikling og kan være ustabil.</li>
					<li>Ikke bruk tjenesten til sensitiv eller taushetsbelagt informasjon.</li>
					<li>Alle parter må informeres før opptak starter.</li>
					<li>Transkripsjoner og oppsummeringer kan inneholde feil — kvalitetssikre alltid resultatet.</li>
					<li>
						Slett lydfilen fra enheten din etter opplasting, og sørg for at den ikke synkroniseres
						til skylagring (f.eks. iCloud, OneDrive). Last aldri opp opptak av elever.
					</li>
				</ul>
			</section>
			<p class="model-info">Modell: Nasjonalbibliotekets nb-whisper-medium</p>
		{/if}
	</div>
{/if}

<ConfirmDeleteDialog bind:show={deleteDialogShow} jobName={deleteDialogJob?.fileName ?? ""} onConfirm={confirmDelete} />

<style>
	.transcription-page {
		max-width: 900px;
		margin: 0 auto;
		padding: 1rem 1.25rem 3rem;
	}

	h1 {
		color: var(--color-primary);
		margin-bottom: 0.5rem;
	}

	.lead {
		color: var(--color-primary-80);
		margin-top: 0;
		margin-bottom: 1.5rem;
	}

	.loading {
		display: flex;
		justify-content: center;
		padding: 3rem;
	}

	.mode-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.mode-card {
		text-align: left;
		background-color: var(--color-secondary-10);
		border: 2px solid var(--color-secondary-30);
		border-radius: 8px;
		padding: 1.25rem;
		cursor: pointer;
		transition: all 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: auto;
		font-family: var(--font-family);
		color: var(--color-primary);
	}

	.mode-card.open:hover {
		background-color: var(--color-secondary-30);
		border-color: var(--color-primary);
		box-shadow: 0 6px 20px rgba(0, 82, 96, 0.18);
		transform: translateY(-2px);
	}

	.mode-card.open.selected {
		border-color: var(--color-primary);
		background-color: var(--color-secondary-30);
		box-shadow: 0 2px 8px rgba(0, 82, 96, 0.15);
	}

	.mode-card.closed {
		background-color: #fdecef;
		border: 2px solid #f7c5cb;
		color: var(--color-danger);
	}

	.mode-card.closed:hover {
		background-color: #f7c5cb;
		border-color: var(--color-danger);
		box-shadow: 0 6px 20px rgba(183, 23, 61, 0.18);
		transform: translateY(-2px);
	}

	.mode-card.closed.selected {
		border-color: var(--color-danger);
		background-color: #f7c5cb;
		box-shadow: 0 2px 8px rgba(183, 23, 61, 0.15);
	}

	.mode-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.mode-header h2 {
		margin: 0;
		font-size: 1.15rem;
		color: inherit;
	}

	/* Red sub-panel */
	.red-panel {
		background-color: #fdecef;
		border: 2px solid var(--color-danger-70);
		border-radius: 8px;
		padding: 1.25rem;
		margin-bottom: 1.5rem;
		color: var(--color-danger);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.red-panel-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 700;
		font-size: 0.95rem;
		margin: 0 0 0.25rem;
		color: var(--color-danger);
	}

	.use-case-btn {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		background: white;
		border: 2px solid var(--color-danger-70);
		border-radius: 6px;
		padding: 0.65rem 1rem;
		cursor: pointer;
		text-align: left;
		color: var(--color-danger);
		font-size: 0.9rem;
		font-weight: 600;
		font-family: var(--font-family);
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.use-case-btn:hover {
		background: #f7c5cb;
		border-color: var(--color-danger);
	}

	.use-case-btn.active {
		background: #f7c5cb;
		border-color: var(--color-danger);
	}

	.use-case-check {
		font-size: 1rem;
		color: var(--color-danger);
	}

	.no-access-box {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		background: #fff0f0;
		border: 1px dashed var(--color-danger);
		border-radius: 6px;
		padding: 0.75rem 1rem;
		font-size: 0.85rem;
		color: var(--color-danger);
		line-height: 1.4;
	}

	.no-access-box .material-symbols-outlined {
		font-size: 1.1rem;
		flex-shrink: 0;
		margin-top: 0.05rem;
	}

	/* Red mode label above action grid */
	.red-mode-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 700;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-danger);
		margin: 0 0 0.5rem;
	}

	.red-mode-label .material-symbols-outlined {
		font-size: 1rem;
	}

	/* Red-themed filled button */
	button.filled-red {
		background-color: var(--color-danger-80);
		color: white;
		border: none;
	}

	button.filled-red:hover:not(:disabled) {
		background-color: var(--color-danger-70);
	}

	button.filled-red:disabled {
		background-color: var(--color-primary-10);
		color: gray;
		cursor: not-allowed;
	}

	.mode-card p,
	.mode-card ul {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.mode-card ul {
		padding-left: 1.25rem;
	}

	.mode-subtitle {
		font-weight: 600;
	}

	.mode-detail {
		font-size: 0.85rem;
		opacity: 0.9;
		margin-top: 0.25rem;
	}

	.warning-panel {
		background-color: #fdecef;
		border: 1px solid var(--color-danger-70);
		border-radius: 8px;
		padding: 1rem 1.25rem;
		margin-bottom: 1.5rem;
		color: var(--color-danger);
	}

	.warning-panel h3 {
		margin: 0 0 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
	}

	.warning-panel ul {
		margin: 0;
		padding-left: 1.5rem;
	}

	.warning-panel li {
		margin-bottom: 0.25rem;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.action-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.action-card {
		background-color: var(--color-primary-10);
		border: 1px solid var(--color-primary-20);
		border-radius: 8px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.action-card h3 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-primary);
		font-size: 1.05rem;
	}

	/* Red-themed action cards — placed after .action-card to win the cascade */
	.action-card-red {
		background-color: #fdecef;
		border: 1px solid var(--color-danger-70);
	}

	.action-card-red h3 {
		color: var(--color-danger);
	}

	.action-card-red .action-description,
	.action-card-red .action-reminder,
	.action-card-red .file-name {
		color: var(--color-danger);
		opacity: 0.85;
	}

	.action-description {
		margin: 0;
		font-size: 0.9rem;
		color: var(--color-primary-80);
		line-height: 1.4;
	}

	.action-reminder {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-primary-80);
	}

	.info-callout {
		background-color: #fff8d6;
		border-left: 3px solid #e0b800;
		padding: 0.75rem;
		font-size: 0.85rem;
		line-height: 1.4;
		border-radius: 4px;
		color: #5a4800;
	}

	.info-callout-red {
		background-color: white;
		border-left: 3px solid var(--color-danger);
		color: var(--color-danger);
	}

	.file-input-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
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
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(0.85); }
	}

	.preview-card {
		background-color: var(--color-primary-10);
		border: 1px solid var(--color-primary-20);
		border-radius: 8px;
		padding: 1.25rem;
		margin-bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.preview-card h3 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-primary);
		font-size: 1.05rem;
	}

	/* Red preview card — placed after .preview-card to win the cascade */
	.preview-card-red {
		background-color: #fdecef;
		border: 1px solid var(--color-danger-70);
	}

	.preview-card-red h3 {
		color: var(--color-danger);
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

	.download-button {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		height: 2rem;
		padding: 0 0.75rem;
		border: 2px solid var(--color-primary);
		border-radius: 4px;
		color: var(--color-primary);
		text-decoration: none;
		font-family: var(--font-family);
	}

	.download-button:hover {
		background-color: var(--color-primary-20);
		color: var(--color-primary);
	}

	.download-button-red {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	.download-button-red:hover {
		background-color: #fdecef;
		color: var(--color-danger);
	}

	.jobs-card {
		background-color: var(--color-primary-10);
		border: 1px solid var(--color-primary-20);
		border-radius: 8px;
		padding: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.jobs-card h3 {
		margin: 0 0 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-primary);
		font-size: 1.05rem;
	}

	.jobs-empty {
		margin: 0;
		color: var(--color-primary-80);
		font-style: italic;
		font-size: 0.9rem;
	}

	.jobs-card-red {
		background-color: #fdecef;
		border-color: #f7c5cb;
	}

	.jobs-card-red h3 {
		color: var(--color-danger);
	}

	.jobs-card-red .jobs-empty {
		color: var(--color-danger);
		opacity: 0.8;
	}

	.jobs-card-red .job-item {
		border-color: #f7c5cb;
	}

	.jobs-card-red .job-item.completed {
		border-left-color: var(--color-danger);
	}

	.jobs-card-red .job-name {
		color: var(--color-danger);
	}

	.jobs-card-red .job-meta {
		color: var(--color-danger);
		opacity: 0.75;
	}

	.jobs-card-red .job-delete {
		color: var(--color-danger);
		opacity: 0.6;
	}

	.jobs-card-red .job-delete:hover {
		opacity: 1;
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
		background-color: white;
		border: 1px solid var(--color-primary-20);
		border-radius: 6px;
		padding: 0.75rem 1rem;
	}

	.job-item.completed {
		border-left: 4px solid var(--color-primary);
	}

	.job-item.failed {
		border-left: 4px solid var(--color-danger);
	}

	.job-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.job-name {
		font-weight: 600;
		color: var(--color-primary);
	}

	.job-status {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.15rem 0.5rem;
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
		margin-top: 0.5rem;
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.job-delete {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-primary-80);
		padding: 0;
		line-height: 1;
		margin-left: auto;
		display: flex;
		align-items: center;
	}

	.job-delete:hover {
		color: var(--color-danger);
	}

	.job-delete .material-symbols-outlined {
		font-size: 1.1rem;
	}

	.model-info {
		font-size: 0.85rem;
		color: var(--color-primary-80);
		margin: 1.5rem 0 1rem;
	}

	@media (max-width: 768px) {
		.mode-grid,
		.action-grid {
			grid-template-columns: 1fr;
		}

		.transcription-page {
			padding: 0.75rem;
		}
	}
</style>
