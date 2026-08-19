<script lang="ts">
	import { page } from "$app/state"
	import AgentCard from "$lib/components/AgentCard.svelte"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()

	let view = $derived(page.url.searchParams.get("view"))
	let showOnlyPrivate = $derived(view === "private")
	let showOnlyPublished = $derived(view === "published")
	let privateAgents = $derived(data.agents.filter((agent) => agent.type === "private"))
	let publishedAgents = $derived(data.agents.filter((agent) => agent.type === "published"))

	let heading = $derived(showOnlyPrivate ? "Dine assistenter" : showOnlyPublished ? "Publiserte assistenter" : "Assistenter")
</script>

<!-- -->
<div class="agents-page">
	<header class="page-header">
		<div>&nbsp;</div>
		<h1>{heading}</h1>
		<a href="/agents/create" class="new-agent-link">
			<button class="filled">
				<span class="material-symbols-outlined">add</span>
				Ny assistent
			</button>
		</a>
	</header>

	{#if showOnlyPrivate}
		{#if privateAgents.length === 0}
			<div class="empty-state">
				<span class="material-symbols-outlined empty-icon">smart_toy</span>
				<p>Ingen egne assistenter funnet</p>
				<a href="/agents/create">Opprett din første assistent</a>
			</div>
		{:else}
			<div class="agents-grid">
				{#each privateAgents as agent}
					<AgentCard {agent} />
				{/each}
			</div>
		{/if}
	{:else if showOnlyPublished}
		{#if publishedAgents.length === 0}
			<div class="empty-state">
				<span class="material-symbols-outlined empty-icon">smart_toy</span>
				<p>Ingen publiserte assistenter funnet</p>
				<a href="/agents/create">Opprett din første assistent</a>
			</div>
		{:else}
			<div class="agents-grid">
				{#each publishedAgents as agent}
					<AgentCard {agent} />
				{/each}
			</div>
		{/if}
	{:else if data.agents.length === 0}
		<div class="empty-state">
			<span class="material-symbols-outlined empty-icon">smart_toy</span>
			<p>Ingen assistenter funnet</p>
			<a href="/agents/create">Opprett din første assistent</a>
		</div>
	{:else}
		<h3>Publiserte</h3>
		<div class="agents-grid">
			{#each publishedAgents as agent}
				<AgentCard {agent} />
			{/each}
		</div>
		<h3>Private</h3>
		<div class="agents-grid">
			{#each privateAgents as agent}
				<AgentCard {agent} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.agents-page {
		max-width: 72rem;
		margin: 0 auto;
		padding: 0rem 1rem 1rem 1rem;
	}

	.page-header {
		height: var(--header-height);
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		margin: 0;
		color: var(--color-primary);
	}

	.new-agent-link {
		text-decoration: none;
	}

	.agents-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		color: var(--color-primary-70);
	}

	.empty-icon {
		font-size: 4rem;
		color: var(--color-primary-30);
		margin-bottom: 1rem;
	}

	.empty-state p {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
	}
</style>