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
	<div class="dialog-layer">
		<button class="dialog-backdrop" type="button" aria-label="Lukk dialog" onclick={() => show = false}></button>
		<div class="dialog" role="dialog" aria-modal="true">
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
	.dialog-layer {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}
	.dialog-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		padding: 0;
		background-color: rgba(0, 0, 0, 0.35);
		cursor: default;
	}
	.dialog {
		position: relative;
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
