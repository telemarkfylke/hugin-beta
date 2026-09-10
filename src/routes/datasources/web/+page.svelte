<script lang="ts">
	import { afterNavigate } from "$app/navigation"
	import type { WebsiteSource } from "$lib/types/website-source"
	import { WebsiteSourcesApi } from "$lib/website-sources/adapters/websiteSourcesApi"
	import WebsiteSourceList from "$lib/website-sources/components/WebsiteSourceList.svelte"

	let sources: WebsiteSource[] = $state([])

	const api = new WebsiteSourcesApi()

	afterNavigate(async () => {
		sources = await api.getSources()
	})
</script>

<p class="lead">
	Opprett navngitte nettside-kilder som AI-agenter kan hente konkrete sider fra. Dette er ikke søk i et vektorisert bibliotek - modellen kan kun hente akkurat de sidene (eller prefiks/domener) du oppgir her, litt som det innebygde websøket, bare avgrenset til dine egne kilder.
</p>

<WebsiteSourceList bind:sources />

<style>
	.lead {
		color: var(--color-primary-80);
		margin-top: 0;
		margin-bottom: 1.5rem;
	}
</style>
