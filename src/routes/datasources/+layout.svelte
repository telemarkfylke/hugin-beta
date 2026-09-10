<script lang="ts">
	import { page } from "$app/state"
	import type { LayoutProps } from "./$types"

	let { children }: LayoutProps = $props()

	const TABS = [
		{ id: "ragservice", label: "Dokumentsøk", icon: "database", href: "/datasources/ragservice" },
		{ id: "mcp", label: "MCP", icon: "cable", href: "/datasources/mcp" },
		{ id: "web", label: "Websites", icon: "public", href: "/datasources/web" }
	]
</script>

<div class="datasources-page">
	<h1>Datakilder</h1>

	<nav class="datasources-tabs">
		{#each TABS as tab (tab.id)}
			<a class="datasources-tab" class:active={page.url.pathname.startsWith(tab.href)} href={tab.href}>
				<span class="material-symbols-outlined">{tab.icon}</span>
				{tab.label}
			</a>
		{/each}
	</nav>

	<div class="datasources-tab-content">
		{@render children()}
	</div>
</div>

<style>
	.datasources-page {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1rem 1.25rem 3rem;
	}

	h1 {
		color: var(--color-primary);
		margin-bottom: 1rem;
	}

	.datasources-tabs {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		white-space: nowrap;
		border-bottom: 2px solid var(--color-primary-20);
		margin-bottom: 1.5rem;
	}

	.datasources-tab {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0.875rem;
		border-radius: 6px 6px 0 0;
		color: var(--color-primary-80);
		font-size: 0.9rem;
		flex-shrink: 0;
		text-decoration: none;
	}

	.datasources-tab:hover {
		background-color: var(--color-primary-10);
	}

	.datasources-tab.active {
		color: var(--color-primary);
		font-weight: 600;
		background-color: var(--color-primary-10);
		box-shadow: inset 0 -2px 0 var(--color-primary);
	}

	@media (max-width: 768px) {
		.datasources-page {
			padding: 0.75rem;
		}
	}
</style>
