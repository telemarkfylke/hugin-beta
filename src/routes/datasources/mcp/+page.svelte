<script lang="ts">
	import { afterNavigate } from "$app/navigation"
	import { McpSourcesApi } from "$lib/mcp-sources/adapters/mcpSourcesApi"
	import McpSourceList from "$lib/mcp-sources/components/McpSourceList.svelte"
	import type { McpSource } from "$lib/types/mcp-source"

	let sources: McpSource[] = $state([])

	const api = new McpSourcesApi()

	afterNavigate(async () => {
		sources = await api.getSources()
	})
</script>

<p class="lead">
	Opprett navngitte MCP-kilder som AI-agenter kan bruke som verktøy. Hver kilde peker til en tjener (i dag: SharePoint hos Telemark fylke) og avgrenser hvilke mapper/filer boten faktisk får tilgang til - ikke søk i et vektorisert bibliotek, men verktøykalling mot den ekte kilden, begrenset til det du velger her.
</p>

<McpSourceList bind:sources />

<style>
	.lead {
		color: var(--color-primary-80);
		margin-top: 0;
		margin-bottom: 1.5rem;
	}
</style>
