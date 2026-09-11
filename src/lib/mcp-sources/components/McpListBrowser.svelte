<script lang="ts">
	import { onMount } from "svelte"
	import { McpSourcesApi } from "$lib/mcp-sources/adapters/mcpSourcesApi"
	import "$lib/ragservice/components/ragservice-shared.css"

	type Props = {
		onSelect: (name: string) => void
	}
	let { onSelect }: Props = $props()

	const api = new McpSourcesApi()

	let lists: string[] = $state([])
	let loading = $state(false)
	let loadError: string | null = $state(null)

	async function load() {
		loading = true
		loadError = null
		try {
			lists = await api.browseSharePointLists()
		} catch (error) {
			loadError = error instanceof Error ? error.message : "Kunne ikke hente lister fra SharePoint akkurat nå."
		} finally {
			loading = false
		}
	}

	onMount(load)
</script>

<div class="list-browser rag-card">
	{#if loading}
		<p class="rag-muted">Laster lister...</p>
	{:else if loadError}
		<p class="error">{loadError}</p>
	{:else if lists.length === 0}
		<p class="rag-muted">Fant ingen lister på SharePoint-området.</p>
	{:else}
		<ul class="list-of-lists">
			{#each lists as name (name)}
				<li>
					<button type="button" class="list-entry" onclick={() => onSelect(name)}>
						<span class="material-symbols-outlined">list_alt</span>{name}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.list-browser {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.list-of-lists {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 14rem;
		overflow-y: auto;
	}

	.list-entry {
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

	.list-entry:hover {
		background-color: var(--color-primary-10);
	}

	p.error {
		color: var(--color-danger);
	}
</style>
