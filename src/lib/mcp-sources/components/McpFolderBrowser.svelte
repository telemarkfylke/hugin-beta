<script lang="ts">
	import { onMount } from "svelte"
	import { McpSourcesApi } from "$lib/mcp-sources/adapters/mcpSourcesApi"
	import "$lib/ragservice/components/ragservice-shared.css"

	type Props = {
		onSelect: (path: string) => void
	}
	let { onSelect }: Props = $props()

	const api = new McpSourcesApi()

	let currentPath = $state("")
	let folders: { name: string; path: string }[] = $state([])
	let loading = $state(false)
	let loadError: string | null = $state(null)

	async function load(path: string) {
		loading = true
		loadError = null
		try {
			const result = await api.browseSharePointFolders(path)
			currentPath = result.parentFolder
			folders = result.folders
		} catch {
			loadError = "Kunne ikke hente mapper fra SharePoint akkurat nå."
		} finally {
			loading = false
		}
	}

	onMount(() => {
		load("")
	})

	function crumbs(path: string): { label: string; path: string }[] {
		if (!path) return []
		const parts = path.split("/")
		return parts.map((part, i) => ({ label: part, path: parts.slice(0, i + 1).join("/") }))
	}
</script>

<div class="folder-browser rag-card">
	<div class="breadcrumbs">
		<button type="button" onclick={() => load("")} disabled={loading}>Rot</button>
		{#each crumbs(currentPath) as crumb (crumb.path)}
			<span>/</span>
			<button type="button" onclick={() => load(crumb.path)} disabled={loading}>{crumb.label}</button>
		{/each}
	</div>

	{#if loading}
		<p class="rag-muted">Laster mapper...</p>
	{:else if loadError}
		<p class="error">{loadError}</p>
	{:else if folders.length === 0}
		<p class="rag-muted">Ingen undermapper her.</p>
	{:else}
		<ul class="folder-list">
			{#each folders as folder (folder.path)}
				<li>
					<button type="button" class="folder-entry" onclick={() => load(folder.path)}>
						<span class="material-symbols-outlined">folder</span>{folder.name}
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="browser-actions">
		<span class="current-path">Gjeldende: {currentPath || "(hele SharePoint-området)"}</span>
		<button type="button" class="filled" onclick={() => onSelect(currentPath)}>Velg denne mappa</button>
	</div>
</div>

<style>
	.folder-browser {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.breadcrumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		font-size: 0.85rem;
	}

	.breadcrumbs button {
		height: auto;
		padding: 2px 6px;
		background: none;
		border: none;
		color: var(--color-primary);
		cursor: pointer;
		text-decoration: underline;
	}

	.folder-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 14rem;
		overflow-y: auto;
	}

	.folder-entry {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 6px;
		text-align: left;
		background: none;
		border: none;
		padding: 6px 8px;
		cursor: pointer;
		border-radius: 4px;
	}

	.folder-entry:hover {
		background-color: var(--color-primary-10);
	}

	.browser-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex-wrap: wrap;
		border-top: 1px solid var(--color-primary-10);
		padding-top: 8px;
	}

	.current-path {
		font-size: 0.8rem;
		color: var(--color-primary-80);
		word-break: break-word;
	}

	p.error {
		color: var(--color-danger);
	}
</style>
