<script lang="ts">
	import type { ChatConfig } from "$lib/types/chat"

	type Props = {
		agent: ChatConfig
	}

	let { agent }: Props = $props()

	// Dato på pent format
	const formatDate = (dateString: string) => {
		const date = new Date(dateString)
		return date.toLocaleDateString("nb-NO", {
			day: "numeric",
			month: "short",
			year: "numeric"
		})
	}

	const getVendorDisplayName = (vendorId: string) => {
		const vendorNames: Record<string, string> = {
			MISTRAL: "Mistral AI",
			OPENAI: "OpenAI",
			OLLAMA: "Ollama"
		}
		return vendorNames[vendorId] || vendorId
	}
</script>

<a href={`/agents/${agent._id}`} class="agent-card-link">
	<article class="agent-card">
		<div class="agent-card-header">
			<h2 class="agent-name">{agent.name || "Uten navn"}</h2>
			{#if agent.type === "published"}
				<span class="badge published" title="Publisert agent">
					<span class="material-symbols-outlined">public</span>
				</span>
			{:else}
				<span class="badge private" title="Privat agent">
					<span class="material-symbols-outlined">lock</span>
				</span>
			{/if}
		</div>

		{#if agent.description}
			<p class="agent-description">{agent.description}</p>
		{:else}
			<p class="agent-description empty">Ingen beskrivelse</p>
		{/if}

		<div class="agent-meta">
			<div class="meta-item">
				<span class="material-symbols-outlined">smart_toy</span>
				<span>{getVendorDisplayName(agent.vendorId)}</span>
			</div>
			{#if agent.model}
				<div class="meta-item">
					<span class="material-symbols-outlined">memory</span>
					<span>{agent.model}</span>
				</div>
			{/if}
			{#if agent.vendorAgent}
				<div class="meta-item">
					<span class="material-symbols-outlined">extension</span>
					<span>Forhåndsdefinert</span>
				</div>
			{/if}
		</div>

		{#if agent.instructions}
			<div class="agent-instructions">
				<span class="material-symbols-outlined">description</span>
				<p>{agent.instructions}</p>
			</div>
		{/if}

		<div class="agent-footer">
			<div class="footer-item">
				<span class="material-symbols-outlined">person</span>
				<span>{agent.created.by.name || "Ukjent"}</span>
			</div>
			<div class="footer-item">
				<span class="material-symbols-outlined">calendar_today</span>
				<span>{formatDate(agent.updated.at)}</span>
			</div>
		</div>
	</article>
</a>

<style>
	.agent-card-link {
		text-decoration: none;
		color: inherit;
		display: block;
	}

	.agent-card {
		background-color: var(--color-primary-10);
		border: 1px solid var(--color-primary-20);
		border-radius: 8px;
		padding: 1.25rem;
		transition: all 0.2s ease;
	}

	.agent-card:hover {
		background-color: var(--color-primary-20);
		border-color: var(--color-primary-30);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 82, 96, 0.15);
	}

	.agent-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.agent-name {
		margin: 0;
		font-size: 1.25rem;
		color: var(--color-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.badge {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
	}

	.badge .material-symbols-outlined {
		font-size: 1rem;
	}

	.badge.published {
		background-color: var(--color-secondary-20);
		color: var(--color-primary);
	}

	.badge.private {
		background-color: var(--color-primary-20);
		color: var(--color-primary-70);
	}

	.agent-description {
		margin: 0 0 1rem 0;
		color: var(--color-primary-80);
		font-size: 0.9rem;
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.agent-description.empty {
		color: var(--color-primary-70);
		font-style: italic;
	}

	.agent-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--color-primary-20);
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--color-primary);
		background-color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.meta-item .material-symbols-outlined {
		font-size: 1rem;
	}

	.agent-instructions {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding: 0.5rem;
		background-color: white;
		border-radius: 4px;
		font-size: 0.8rem;
		color: var(--color-primary-80);
	}

	.agent-instructions .material-symbols-outlined {
		font-size: 1rem;
		color: var(--color-primary-70);
		flex-shrink: 0;
	}

	.agent-instructions p {
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.4;
	}

	.agent-footer {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.footer-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--color-primary-70);
	}

	.footer-item .material-symbols-outlined {
		font-size: 0.9rem;
	}
</style>
