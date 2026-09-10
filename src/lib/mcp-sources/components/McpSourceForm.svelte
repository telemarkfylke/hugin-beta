<script lang="ts">
	import { McpSourcesApi } from "$lib/mcp-sources/adapters/mcpSourcesApi"
	import type { McpSource, SharePointFolderEntry } from "$lib/types/mcp-source"
	import "$lib/ragservice/components/ragservice-shared.css"
	import McpFolderBrowser from "./McpFolderBrowser.svelte"

	type Props = {
		source: McpSource | null // null = creating a new source
		onDone: (result: McpSource | null) => void
	}
	let { source, onDone }: Props = $props()

	// Only "sharepoint" exists today - the select below still shows it as a choice (not just
	// static text) since it's very likely not the last MCP server Hugin ever connects to, and the
	// form/data model are already built to add a second option later without a redesign.
	const server = "sharepoint" as const

	let name = $state(source?.name ?? "")
	let published = $state(source?.type === "published")

	// "Whole area" (an empty-value prefix entry, see isFolderPathAllowed in
	// scoped-sharepoint-client.ts) is a DELIBERATE, explicit toggle, not something that can arise
	// from merely leaving a folder row's text field blank - a blank row is dropped as invalid on
	// save instead (see save() below). An earlier version conflated the two: any leftover blank
	// "prefix"-type row got silently saved as-is, which meant an admin who added a row and simply
	// forgot to fill in the value ended up granting the bot unrestricted access to the entire
	// SharePoint area, with no warning anywhere.
	const initialFolders = source?.server === "sharepoint" ? source.folders : []
	let wholeAreaAccess = $state(initialFolders.some((f) => f.matchType === "prefix" && f.value.trim() === ""))
	let folders: SharePointFolderEntry[] = $state(initialFolders.filter((f) => !(f.matchType === "prefix" && f.value.trim() === "")).map((f) => ({ ...f })))
	let searchEnabled = $state(source?.server === "sharepoint" ? source.searchEnabled : false)

	let showBrowser = $state(false)

	const api = new McpSourcesApi()

	let saving = $state(false)
	let saveError: string | null = $state(null)

	function addFolder() {
		folders.push({ value: "", matchType: "prefix" })
	}

	function removeFolder(index: number) {
		folders.splice(index, 1)
	}

	function onFolderPicked(path: string) {
		folders.push({ value: path, matchType: "prefix" })
		showBrowser = false
	}

	async function save() {
		saving = true
		saveError = null
		try {
			// Blank rows are dropped, always - never silently kept as-is (see wholeAreaAccess comment
			// above). "Whole area" only ever comes from the explicit toggle, appended here.
			const trimmedFolders = folders.filter((f) => f.value.trim()).map((f) => ({ value: f.value.trim(), matchType: f.matchType }))
			if (wholeAreaAccess) {
				trimmedFolders.push({ value: "", matchType: "prefix" })
			}
			if (trimmedFolders.length === 0 && !searchEnabled) {
				saveError = "Legg til minst én mappe, aktiver tilgang til hele området, eller aktiver fritekst-søk."
				return
			}
			const input = { server, name: name.trim(), type: published ? ("published" as const) : ("private" as const), folders: trimmedFolders, searchEnabled }
			const result = source ? await api.updateSource(source._id, input) : await api.createSource(input)
			if (result) {
				onDone(result)
			} else {
				saveError = "Kunne ikke lagre kilden. Prøv igjen."
			}
		} finally {
			saving = false
		}
	}

	function cancel() {
		onDone(null)
	}
</script>

<main class="rag-card">
	<h3 class="rag-section-title">Kilde</h3>
	<div class="rag-field-grid">
		<div class="rag-simple-field">
			<span class="rag-field-label">Navn</span>
			<input type="text" bind:value={name} placeholder="F.eks. Budsjett-mappa" />
		</div>
		<div class="rag-simple-field">
			<span class="rag-field-label">Tjener</span>
			<select value={server} disabled>
				<option value="sharepoint">SharePoint (Telemark fylke)</option>
			</select>
		</div>
		<div class="rag-simple-field">
			<label class="rag-field-label" for="published">Gjør denne kilden offentlig</label>
			<input id="published" type="checkbox" bind:checked={published} />
		</div>
	</div>
	<p class="rag-muted">
		{#if published}
			Andre ansatte kan se og velge denne kilden til sine egne assistenter. Bare du (eller en admin) kan fortsatt redigere eller slette den.
		{:else}
			Privat - kun synlig for deg. Ingen andre kan se, velge, redigere eller slette den.
		{/if}
	</p>

	<h3 class="rag-section-title">Mapper</h3>
	<p class="rag-muted">Styrer hvilke mapper boten kan liste, se treet i og lese innhold fra. "Prefiks" dekker mappa og alt under den. En tom rad lagres ikke - blir den stående tom, forsvinner den bare når du lagrer.</p>
	<div class="entry-rows">
		{#each folders as folder, i}
			<div class="entry-row">
				<input type="text" placeholder="F.eks. Ruens hjørne/Trudelutt" bind:value={folder.value} />
				<select bind:value={folder.matchType}>
					<option value="prefix">Prefiks (mappe + alt under)</option>
					<option value="exact">Eksakt mappe</option>
				</select>
				<button type="button" class="icon-button" onclick={() => removeFolder(i)} title="Fjern mappe">
					<span class="material-symbols-outlined">close</span>
				</button>
			</div>
		{/each}
		<div class="folder-add-actions">
			<button type="button" class="add-entry-btn" onclick={addFolder}>
				<span class="material-symbols-outlined">add</span> Skriv inn manuelt
			</button>
			<button type="button" class="add-entry-btn" onclick={() => (showBrowser = !showBrowser)}>
				<span class="material-symbols-outlined">folder_open</span> {showBrowser ? "Skjul mappe-utforsker" : "Bla gjennom SharePoint"}
			</button>
		</div>
		{#if showBrowser}
			<McpFolderBrowser onSelect={onFolderPicked} />
		{/if}
	</div>

	<div class="rag-field-grid whole-area-field">
		<div class="rag-simple-field">
			<label class="rag-field-label" for="whole-area-access">⚠️ Gi tilgang til HELE SharePoint-området (ingen mappe-begrensning)</label>
			<input id="whole-area-access" type="checkbox" bind:checked={wholeAreaAccess} />
		</div>
	</div>
	{#if wholeAreaAccess}
		<p class="rag-muted whole-area-warning">Denne kilden blir da ikke begrenset til noen mappe i det hele tatt - boten kan lese alt tjenestekontoen har tilgang til i SharePoint, uavhengig av mappene listet over.</p>
	{/if}

	<h3 class="rag-section-title">Fritekst-søk</h3>
	<div class="rag-field-grid">
		<div class="rag-simple-field">
			<label class="rag-field-label" for="search-enabled">Tillat fritekst-søk (Search_SharePoint)</label>
			<input id="search-enabled" type="checkbox" bind:checked={searchEnabled} />
		</div>
	</div>
	<p class="rag-muted search-warning">
		Dette søker i hele organisasjonens SharePoint-indeks - uavhengig av mappene over, siden søket ikke kan avgrenses til en mappe. Avventer avklaring med MCP-serverens eier om dette bør tilbys i det hele tatt - la stå av med mindre du vet hva du gjør.
	</p>

	<div class="actions">
		<button onclick={cancel} disabled={saving}>Avbryt</button>
		<button class="filled" onclick={save} disabled={saving}>{saving ? "Lagrer..." : "Lagre"}</button>
	</div>

	{#if saveError}
		<p class="error">{saveError}</p>
	{/if}
</main>

<style>
	.entry-rows {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.entry-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.entry-row input[type="text"] {
		flex: 1;
	}

	.folder-add-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	button.add-entry-btn {
		align-self: flex-start;
		height: auto;
		font-size: small;
		background: none;
		border: 1px dashed var(--color-primary-30);
		color: var(--color-primary);
		cursor: pointer;
		padding: 4px 8px;
	}

	.search-warning {
		margin-top: -8px;
	}

	.whole-area-field {
		margin-top: 12px;
	}

	.whole-area-warning {
		margin-top: -8px;
		color: var(--color-danger);
	}

	div.actions {
		display: flex;
		gap: 8px;
		margin-top: 20px;
	}

	p.error {
		color: var(--color-danger);
		margin-top: 12px;
	}
</style>
