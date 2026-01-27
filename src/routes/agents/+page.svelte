<script lang="ts">
	import AgentCard from "$lib/components/AgentCard.svelte"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()
</script>

<!-- -->
<div class="agents-page">
	<header class="page-header">
		<h1>Agenter</h1>
		<a href="/agents/create" class="new-agent-link">
			<button class="filled">
				<span class="material-symbols-outlined">add</span>
				Ny agent
			</button>
		</a>
	</header>

	{#if data.agents.length === 0}
		<div class="empty-state">
			<span class="material-symbols-outlined empty-icon">smart_toy</span>
			<p>Ingen agenter funnet</p>
			<a href="/agents/create">Opprett din første agent</a>
		</div>
	{:else}
		<div class="agents-grid">
			{#each data.agents as agent}
				<AgentCard {agent} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.agents-page {
		max-width: 72rem;
		margin: 0 auto;
		padding: 1.5rem;
	}

	.page-header {
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