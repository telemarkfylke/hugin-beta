<script lang="ts">
	import { page } from "$app/state"
	import type { LayoutProps } from "./$types"
	import { CANVAS_TOOLS, shouldShowToolTabs } from "./tools"

	let { children }: LayoutProps = $props()
</script>

<div class="canvas-shell">
	{#if shouldShowToolTabs(CANVAS_TOOLS)}
		<nav class="canvas-tabs">
			{#each CANVAS_TOOLS as tool (tool.id)}
				<a class="canvas-tab" class:active={page.url.pathname.startsWith(tool.href)} href={tool.href}>
					<span class="material-symbols-outlined">{tool.icon}</span>
					{tool.label}
				</a>
			{/each}
		</nav>
	{/if}
	<div class="canvas-shell-body">
		{@render children()}
	</div>
</div>

<style>
	.canvas-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background-color: #f0f0ef;
	}

	.canvas-tabs {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem 1.5rem;
		overflow-x: auto;
		white-space: nowrap;
		border-bottom: 1px solid var(--color-primary-30);
		flex-shrink: 0;
	}

	.canvas-tab {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.35rem 0.75rem;
		border-radius: 14px;
		color: var(--color-primary);
		flex-shrink: 0;
		text-decoration: none;
	}

	.canvas-tab.active {
		background-color: var(--color-primary);
		color: white;
		font-weight: 700;
	}

	.canvas-shell-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
	}
</style>
