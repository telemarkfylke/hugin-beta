<script lang="ts">
	import type { S3PocObject } from "$lib/types/s3-poc"

	type UploadItem = { name: string; size: number; status: "waiting" | "uploading" | "done" | "error"; progress: number; message: string }

	const { data } = $props()

	let fileInputEl: HTMLInputElement | undefined = $state()
	let items: UploadItem[] = $state([])
	let isUploading = $state(false)
	let refreshedObjects: S3PocObject[] | null = $state(null)
	let listError: string | null = $state(null)

	const objects = $derived(refreshedObjects ?? data.objects)
	const visibleListError = $derived(listError ?? (refreshedObjects ? null : data.listError))

	const formatBytes = (bytes: number): string => {
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
	}

	const formatDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleString("nb-NO") : "")

	const refreshList = async () => {
		try {
			const response = await fetch("/api/s3-poc")
			if (!response.ok) throw new Error(`HTTP ${response.status}`)
			refreshedObjects = ((await response.json()) as { objects: S3PocObject[] }).objects
			listError = null
		} catch {
			listError = "Kunne ikke hente listen med filer."
		}
	}

	// fetch() can't report upload progress, so XMLHttpRequest
	const putFile = (file: File, onProgress: (percent: number) => void): Promise<{ status: number; body: string }> =>
		new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest()
			xhr.open("PUT", `/api/s3-poc?name=${encodeURIComponent(file.name)}`)
			xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
			}
			xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText })
			xhr.onerror = () => reject(new Error("Nettverksfeil under opplasting"))
			xhr.onabort = () => reject(new Error("Opplastingen ble avbrutt"))
			xhr.send(file)
		})

	const errorMessageFrom = (status: number, body: string): string => {
		try {
			const message = (JSON.parse(body) as { message?: string }).message
			if (message) return `${message} (${status})`
		} catch {
			// not JSON - fall through
		}
		return `Opplastingen feilet (${status})`
	}

	const updateItem = (index: number, patch: Partial<UploadItem>) => {
		const current = items[index]
		if (current) items[index] = { ...current, ...patch }
	}

	const uploadSelected = async () => {
		const files = Array.from(fileInputEl?.files ?? [])
		if (files.length === 0 || isUploading) return
		isUploading = true
		items = files.map((file) => ({ name: file.name, size: file.size, status: "waiting", progress: 0, message: "" }))

		for (const [index, file] of files.entries()) {
			if (file.size > data.maxUploadBytes) {
				updateItem(index, { status: "error", message: `Filen er for stor (maks ${formatBytes(data.maxUploadBytes)})` })
				continue
			}
			updateItem(index, { status: "uploading" })
			try {
				const { status, body } = await putFile(file, (percent) => updateItem(index, { progress: percent }))
				updateItem(index, status === 201 ? { status: "done", progress: 100 } : { status: "error", message: errorMessageFrom(status, body) })
			} catch (error) {
				updateItem(index, { status: "error", message: error instanceof Error ? error.message : "Opplastingen feilet" })
			}
		}

		isUploading = false
		if (fileInputEl) fileInputEl.value = ""
		await refreshList()
	}
</script>

<div class="s3-poc">
	<h1>S3-test (Silo)</h1>
	<p class="lead">
		Midlertidig testside for admin. Filene lastes opp via Hugin til bøtta <code>{data.bucket}</code> på
		<code>s3.ki.telemarkfylke.no</code>, under <code>s3-poc/&lt;din bruker-id&gt;/</code>. Åpne Silo-konsollen for å se at de dukker opp.
	</p>

	<section class="card" aria-labelledby="upload-title">
		<h2 id="upload-title">Last opp</h2>
		<div class="row">
			<input type="file" multiple bind:this={fileInputEl} disabled={isUploading} aria-label="Velg filer" />
			<button class="filled" onclick={uploadSelected} disabled={isUploading}>
				<span class="material-symbols-outlined">cloud_upload</span>
				{isUploading ? "Laster opp…" : "Last opp"}
			</button>
		</div>
		<p class="hint">Maks {formatBytes(data.maxUploadBytes)} per fil.</p>

		{#if items.length > 0}
			<ul class="items" aria-live="polite">
				{#each items as item}
					<li class="item {item.status}">
						<span class="name">{item.name}</span>
						<span class="size">{formatBytes(item.size)}</span>
						{#if item.status === "uploading"}
							<progress value={item.progress} max="100">{item.progress}%</progress>
						{:else if item.status === "done"}
							<span class="state ok">Lastet opp</span>
						{:else if item.status === "error"}
							<span class="state err" role="alert">{item.message}</span>
						{:else}
							<span class="state">Venter</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="card" aria-labelledby="files-title">
		<div class="row">
			<h2 id="files-title">Filer i S3</h2>
			<button onclick={refreshList} disabled={isUploading}><span class="material-symbols-outlined">refresh</span> Oppdater</button>
		</div>
		{#if visibleListError}
			<p class="state err" role="alert">{visibleListError}</p>
		{:else if objects.length === 0}
			<p class="hint">Ingen filer ennå.</p>
		{:else}
			<table>
				<thead>
					<tr><th>Fil</th><th>Størrelse</th><th>Lastet opp</th></tr>
				</thead>
				<tbody>
					{#each objects as object (object.key)}
						<tr><td>{object.fileName}</td><td>{formatBytes(object.size)}</td><td>{formatDate(object.lastModified)}</td></tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</div>

<style>
	.s3-poc {
		max-width: 52rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
	}
	.lead {
		margin-bottom: 1.5rem;
	}
	.card {
		background-color: var(--vann-10);
		padding: 1rem 1.25rem;
		margin-bottom: 1.5rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
	}
	.hint {
		margin: 0.5rem 0 0;
		opacity: 0.8;
	}
	.items {
		list-style: none;
		padding: 0;
		margin: 1rem 0 0;
	}
	.item {
		display: grid;
		grid-template-columns: 1fr auto 12rem;
		gap: 0.75rem;
		align-items: center;
		padding: 0.4rem 0;
		border-top: 1px solid rgba(0, 0, 0, 0.1);
	}
	.name {
		overflow-wrap: anywhere;
	}
	.size {
		opacity: 0.8;
	}
	progress {
		width: 100%;
	}
	.state.ok {
		color: green;
	}
	.state.err {
		color: #b00020;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.75rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.4rem 0.5rem;
		border-top: 1px solid rgba(0, 0, 0, 0.1);
		overflow-wrap: anywhere;
	}
</style>
