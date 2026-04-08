<script lang="ts">
	import { onMount } from "svelte"
	import IconSpinner from "$lib/components/IconSpinner.svelte"
	import InfoBox from "$lib/components/InfoBox.svelte"

	type TranscriptionMode = "open" | "closed"

	const MAX_FILE_SIZE_MB = 150
	const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
	const ACCEPTED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".mp4", ".mov", ".avi"]
	const ACCEPTED_MIME_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/mp4", "audio/x-m4a", "video/mp4", "video/quicktime", "video/x-msvideo"]
	const ACCEPT_ATTR = [...ACCEPTED_EXTENSIONS, ...ACCEPTED_MIME_TYPES].join(",")

	const { VITE_MOCK_API: mockApi } = import.meta.env

	let selectedMode: TranscriptionMode = $state("open")
	let isLoading = $state(true)

	// Recording state
	let mediaRecorder: MediaRecorder | undefined
	let audioChunks: Blob[] = []
	let audioBlob: Blob | undefined = $state()
	let audioUrl: string | undefined = $state()
	let recording = $state(false)
	let timer = $state(0)
	let timerInterval: ReturnType<typeof setInterval> | undefined

	// Upload state
	let fileInputEl: HTMLInputElement | undefined = $state()
	let fileError = $state("")
	let submitStatus: "idle" | "sending" | "sent" | "error" = $state("idle")
	let submitMessage = $state("")

	let metadata = $state({
		filnavn: "",
		spraak: "",
		format: "",
		selectedFileName: null as string | null
	})

	const formatTimer = (seconds: number) => {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, "0")
		const s = (seconds % 60).toString().padStart(2, "0")
		return `${m}:${s}`
	}

	onMount(async () => {
		if (mockApi && mockApi === "true") {
			await new Promise((resolve) => setTimeout(resolve, 500))
		}
		isLoading = false
	})

	const selectMode = (mode: TranscriptionMode) => {
		if (mode === "closed") return // disabled for now
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
				metadata.filnavn = "mittopptak.wav"
				audioBlob = new Blob(audioChunks, { type: "audio/wav" })
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

		metadata.filnavn = selectedFile.name
		metadata.selectedFileName = selectedFile.name
		audioBlob = new Blob([selectedFile], { type: selectedFile.type || "audio/wav" })
		audioUrl = URL.createObjectURL(audioBlob)
	}

	const sendTilTranscript = async () => {
		if (!audioBlob) return
		submitStatus = "sending"
		submitMessage = ""

		try {
			const datapakken = new FormData()
			datapakken.append("filelist", audioBlob)
			datapakken.append("metadata", JSON.stringify(metadata))

			const result = await fetch(`/api/transcription`, {
				method: "POST",
				body: datapakken
			})

			if (!result.ok) {
				const errorData = await result.json().catch(() => ({}))
				submitStatus = "error"
				submitMessage = `Transkripsjon feilet: ${errorData.message || result.statusText}`
				return
			}

			submitStatus = "sent"
			submitMessage = "Transkripsjonsjobben er sendt. Du får resultatet på e-post."
		} catch (error) {
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
			Spill inn eller last opp lyd og få transkripsjonen tilsendt på e-post til brukeren du er logget inn med.
		</p>

		<!-- Mode selection -->
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

		<!-- Warning panel -->
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

		<!-- Action cards -->
		<div class="action-grid">
			<!-- Upload -->
			<section class="action-card" aria-labelledby="upload-title">
				<h3 id="upload-title">
					<span class="material-symbols-outlined">upload_file</span>
					Last opp en lydfil
				</h3>
				<p class="action-description">
					Last opp lydklipp i formatene MP3, WAV, M4A, MP4, MOV eller AVI (maks {MAX_FILE_SIZE_MB} MB).
					Den ferdige transkripsjonen og en oppsummering blir sendt til deg på e-post.
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
						{metadata.selectedFileName ?? "Ingen fil er valgt"}
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

			<!-- Record -->
			<section class="action-card" aria-labelledby="record-title">
				<h3 id="record-title">
					<span class="material-symbols-outlined">mic</span>
					…eller spill inn lyd
				</h3>
				<div class="info-callout">
					<strong>NB!</strong> Husk å laste ned lydopptaket før du sender til transkribering
					i tilfelle noe går galt eller om du trenger en backup. Lydopptaket slettes umiddelbart etter
					at det er sendt avgårde.
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

		<!-- Preview & submit -->
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
						{submitStatus === "sending" ? "Sender…" : submitStatus === "sent" ? "Sendt" : "Send til transkripsjon"}
					</button>
					<a href={audioUrl} download={metadata.filnavn || "opptak.wav"} class="download-button">
						<span class="material-symbols-outlined">download</span>
						Last ned opptak
					</a>
				</div>
				{#if submitMessage}
					<p class:error-text={submitStatus === "error"} class:success-text={submitStatus === "sent"}>
						{submitMessage}
					</p>
				{/if}
			</section>
		{/if}

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

	/* --- Mode selection --- */
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

	/* --- Warning panel --- */
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

	/* --- Action cards --- */
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

	/* --- Preview card --- */
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

	.model-info {
		font-size: 0.85rem;
		color: var(--color-primary-80);
		margin: 1.5rem 0 1rem;
	}

	/* --- Responsive --- */
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
