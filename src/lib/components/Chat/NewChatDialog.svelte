<script lang="ts">
	type Props = {
		show: boolean
		onConfirm: () => void
	}

	let { show = $bindable(), onConfirm }: Props = $props()

	const STORAGE_KEY = "hugin_skip_new_chat_confirm"
	let dontShow: boolean = $state(false)

	$effect(() => {
		if (show) dontShow = false
	})

	const confirm = () => {
		if (dontShow) localStorage.setItem(STORAGE_KEY, "true")
		show = false
		onConfirm()
	}
</script>

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="dialog-backdrop" onclick={() => show = false}>
		<div class="dialog" onclick={(e) => e.stopPropagation()}>
			<p>Er du sikker på at du vil starte en ny samtale? Velg import/eksport for å lagre samtalen din lokalt.</p>
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={dontShow} />
				Ikke vis denne advarselen igjen
			</label>
			<div class="dialog-actions">
				<button onclick={() => show = false}>Avbryt</button>
				<button class="filled" onclick={confirm}>Start ny samtale</button>
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
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: small;
		color: inherit;
		cursor: pointer;
	}
	.checkbox-label input {
		width: auto;
	}
</style>
