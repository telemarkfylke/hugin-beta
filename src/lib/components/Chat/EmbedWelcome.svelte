<script lang="ts">
	type Props = {
		welcomeMessage: string
		suggestedQuestions: string[]
		onSuggestionClick: (question: string) => void
	}
	let { welcomeMessage, suggestedQuestions, onSuggestionClick }: Props = $props()
</script>

<div class="embed-welcome">
	<p class="embed-welcome-message">{welcomeMessage}</p>
	{#if suggestedQuestions.length > 0}
		<div class="embed-suggestions">
			{#each suggestedQuestions as question}
				<button type="button" class="embed-suggestion-chip" onclick={() => onSuggestionClick(question)}>
					{question}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.embed-welcome {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem 0.25rem 1rem;
	}

	.embed-welcome-message {
		margin: 0;
		color: var(--embed-text);
		font-size: 0.95rem;
	}

	.embed-suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.embed-suggestion-chip {
		border: 1px solid var(--color-primary);
		color: var(--color-primary);
		background: transparent;
		border-radius: 999px;
		padding: 0.45rem 0.9rem;
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		transition:
			background-color 0.15s,
			color 0.15s;
	}

	.embed-suggestion-chip:hover {
		background: var(--color-primary);
		color: var(--embed-accent-fg, #ffffff);
	}
</style>
