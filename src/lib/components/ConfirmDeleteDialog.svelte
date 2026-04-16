<script lang="ts">
	type Props = {
		show: boolean
		jobName: string
		onConfirm: () => void
	}

	let { show = $bindable(), jobName, onConfirm }: Props = $props()
</script>

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="dialog-backdrop" onclick={() => (show = false)}>
		<div class="dialog" onclick={(e) => e.stopPropagation()}>
			<p>Er du sikker på at du vil slette <strong>{jobName}</strong>?</p>
			<p class="dialog-sub">Lydfilen og eventuelle dokumenter vil bli slettet fra serveren.</p>
			<div class="dialog-actions">
				<button onclick={() => (show = false)}>Avbryt</button>
				<button class="filled danger" onclick={() => { show = false; onConfirm() }}>Slett</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.dialog-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.dialog {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		max-width: 26rem;
		width: 90%;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
	}

	.dialog p {
		margin: 0;
		line-height: 1.5;
	}

	.dialog-sub {
		font-size: 0.9rem;
		color: var(--color-primary-80);
		line-height: 1.4;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	button.filled.danger {
		background-color: var(--color-danger);
		border-color: var(--color-danger);
	}

	button.filled.danger:hover {
		background-color: var(--color-danger-70);
		border-color: var(--color-danger-70);
	}
</style>
