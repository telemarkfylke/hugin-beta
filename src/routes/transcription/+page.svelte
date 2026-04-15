<script lang="ts">
	import { onDestroy, onMount } from "svelte"
	import IconSpinner from "$lib/components/IconSpinner.svelte"
	import InfoBox from "$lib/components/InfoBox.svelte"
	import type { TranscriptionJob } from "$lib/server/transcription/types"

	type TranscriptionMode = "open" | "closed"

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
			jobs = body.jobs ?? []

			// Stop polling when all jobs are terminal
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
		await refreshJobs()
		if (hasActiveJobs()) {
			pollInterval = setInterval(refreshJobs, 5000)
		}
		isLoading = false
	})

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval)
	})

	const selectMode = (mode: TranscriptionMode) => {
		if (mode === "closed") return
		selectedMode = mode
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

			const uploadUrl = `/api/transcription/upload/${encodeURIComponent(userId)}/${encodeURIComponent(selectedFileName)}`
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
		<h1>Eksperimentell selvbetjeningsløsning for transkripsjon av tale</h1>
		<p class="lead">
			Spill inn eller last opp lyd. Filen lastes opp og resultatet dukker opp i listen under når transkripsjonen er ferdig.
		</p>

		<div class="mode-grid" role="radiogroup" aria-label="Velg transkripsjonsmodus">
			<button
				type="button"
				class="mode-card open"
				class:selected={selectedMode === "open"}
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
					Det er mulig å laste opp en fil for transkripsjon. Innholdet i samtalen må være åpent.
					Informasjonen kan bli behandlet av eksterne tjenester som OpenAI, Mistral eller Nasjonalbibliotekets whisper.
				</p>
			</button>

			<button
				type="button"
				class="mode-card closed"
				class:selected={selectedMode === "closed"}
				role="radio"
				aria-checked={selectedMode === "closed"}
				aria-disabled="true"
				disabled
				onclick={() => selectMode("closed")}
			>
				<div class="mode-header">
					<span class="material-symbols-outlined">lock</span>
					<h2>Lukket transkripsjon</h2>
					<span class="badge-coming">Kommer snart</span>
				</div>
				<p class="mode-subtitle">Bruk denne hvis samtalen inneholder:</p>
				<ul>
					<li>Personopplysninger</li>
					<li>Helseopplysninger</li>
					<li>Andre sensitive opplysninger</li>
				</ul>
				<p class="mode-detail">
					Det er ikke mulig å laste opp eller laste ned opptak. Kun opptak i nettleser.
					Informasjonen behandles internt i Telemark fylkeskommune.
				</p>
			</button>
		</div>

		<div class="action-grid">
			<section class="action-card" aria-labelledby="upload-title">
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

			<section class="action-card" aria-labelledby="record-title">
				<h3 id="record-title">
					<span class="material-symbols-outlined">mic</span>
					…eller spill inn lyd
				</h3>
				<div class="info-callout">
					<strong>NB!</strong> Husk å laste ned lydopptaket før du sender til transkribering
					i tilfelle noe går galt eller om du trenger en backup.
				</div>

				<button
					type="button"
					class="filled"
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
			<section class="preview-card" aria-label="Forhåndsvisning">
				<h3>
					<span class="material-symbols-outlined">play_circle</span>
					Forhåndsvisning
				</h3>
				<audio controls src={audioUrl}></audio>
				<div class="preview-actions">
					<button
						type="button"
						class="filled"
						onclick={sendTilTranscript}
						disabled={submitStatus === "sending" || submitStatus === "sent"}
					>
						<span class="material-symbols-outlined">send</span>
						{submitStatus === "sending" ? "Laster opp…" : submitStatus === "sent" ? "Sendt" : "Send til transkripsjon"}
					</button>
					<a href={audioUrl} download={selectedFileName || "opptak.webm"} class="download-button">
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

		<section class="jobs-card" aria-label="Transkripsjoner">
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

		<InfoBox title="Personvernerklæring">
			<h1>Personvernerklæring for Selvbetjeningsløsning for transkribering i Hugin</h1>

			<h2>Innledning</h2>
			<p>
				Denne personvernerklæringen beskriver hvordan selvbetjeningsløsning for transkribering i Hugin
				samler inn og bruker personopplysninger når du bruker vår tjeneste for transkribering av lydopptak.
				Ved å benytte tjenesten, godtar du behandling av dine personopplysninger i henhold til denne erklæringen.
			</p>

			<h2>Hvor lagres dataene?</h2>
			<ul>
				<li>
					<strong>Telemark fylkeskommunes Azure-installasjon</strong> (datasenter i Norge):<br />
					Her lagres kun lydklippet som sendes inn.
				</li>
				<li>
					<strong>Lokal server på fylkeshuset:</strong><br />
					Her lages transkriberingen midlertidig før den sendes til bruker. Transkripsjonen slettes etter at den er sendt.
				</li>
			</ul>

			<h2>Hva samles inn</h2>
			<ul>
				<li><strong>Lydopptak:</strong> Når du laster opp eller leser inn lydfiler for transkribering.</li>
				<li><strong>Personlige opplysninger:</strong> Navn og e-postadresse som er nødvendig for å sende deg transkriberte tekster.</li>
				<li><strong>Bruksinformasjon:</strong> Statistikk over bruk og feillogger som lagres på lokal server. Disse dataene er anonymisert.</li>
			</ul>

			<h2>Formål</h2>
			<ul>
				<li><strong>Transkribering:</strong> For å transkribere lydopptakene du sender inn med norsk språkmodell.</li>
				<li><strong>Forbedring av tjenesten:</strong> For å analysere bruken av vår tjeneste og forbedre våre tjenester.</li>
			</ul>

			<h2>Deling av informasjon</h2>
			<p>
				Ingen informasjon deles eller gjenbrukes til andre eller i andre sammenhenger. Det logges kun
				statistikk for bruk, men denne inneholder ingen informasjon om innhold.
			</p>

			<h2>Sikkerhet</h2>
			<p>
				Innlogging skjer på fylkeskommunens tjenester. All dataoverføring skjer enten med HTTPS
				og/eller kryptert kommunikasjon.
			</p>

			<h2>Lagring av data</h2>
			<p>
				Dine lydopptak og transkriberte dokumenter blir mellomlagret i inntil en time for prosessering.
				Alle data blir umiddelbart slettet når transkriberingen er gjort. Lydopptaket blir slettet i det
				det blir sendt til prosessering. Det kan være retention-policyer på tenant-nivå som muliggjør
				gjenoppretting av filer innen en viss tidsperiode.
			</p>

			<h2>Dine rettigheter</h2>
			<ul>
				<li><strong>Innsyn:</strong> Du har rett til å be om innsyn i hvilke personopplysninger vi har lagret om deg.</li>
				<li><strong>Rettelse:</strong> Du kan be om å få korrigert feilaktige personopplysninger.</li>
				<li><strong>Sletting:</strong> Du kan be om sletting av dine personopplysninger, med visse unntak som kreves ved lov.</li>
			</ul>

			<h2>Kontaktinformasjon</h2>
			<p>
				Hvis du har spørsmål eller bekymringer om denne personvernerklæringen, vennligst kontakt oss på
				<a href="mailto:noen@telemarkfylke.no">noen@telemarkfylke.no</a>.
			</p>
		</InfoBox>
	</div>
{/if}

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
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: auto;
		font-family: var(--font-family);
		color: var(--color-primary);
	}

	.mode-card.open:hover {
		background-color: var(--color-secondary-20);
		border-color: var(--color-primary);
	}

	.mode-card.open.selected {
		border-color: var(--color-primary);
		background-color: var(--color-secondary-20);
		box-shadow: 0 2px 8px rgba(0, 82, 96, 0.15);
	}

	.mode-card.closed {
		background-color: #fdecef;
		border: 2px dashed var(--color-danger-70);
		color: var(--color-danger);
		cursor: not-allowed;
		opacity: 0.85;
	}

	.mode-card.closed:hover {
		background-color: #fdecef;
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

	.badge-coming {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background-color: var(--color-danger);
		color: white;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		margin-left: auto;
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
