<script lang="ts">
	import type { Snippet } from "svelte"
	import TypingDots from "$lib/components/TypingDots.svelte"

	type Props = {
		value: string
		placeholder: string
		isLoading?: boolean
		sendDisabled?: boolean
		onSubmit: () => void
		actions?: Snippet
	}
	let { value = $bindable(), placeholder, isLoading = false, sendDisabled = false, onSubmit, actions }: Props = $props()

	let textArea: HTMLTextAreaElement
	let wrapDiv: HTMLDivElement

	$effect(() => {
		value // Track changes to value
		if (wrapDiv && textArea) {
			wrapDiv.setAttribute("data-replicated-value", textArea.value)
		}
	})

	const submitOnEnter = (event: KeyboardEvent) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault()
			if (!sendDisabled && !isLoading) {
				onSubmit()
			}
		}
	}
</script>

<div class="input-wrapper">
	<div class="input-row">
		<div class="input-text">
			<div class="grow-wrap" bind:this={wrapDiv}>
				<textarea bind:this={textArea} bind:value {placeholder} onkeydown={submitOnEnter} rows={1}></textarea>
			</div>
		</div>

		<div class="input-actions">
			{#if actions}
				{@render actions()}
			{/if}
		</div>

		<div class="input-submit">
			{#if isLoading}
				<button class="icon-button input-action-button send" disabled title="Sender...">
					<TypingDots />
				</button>
			{:else}
				<button class="icon-button filled input-action-button send" onclick={onSubmit} disabled={sendDisabled} title="Send (Enter)" type="button">
					<span class="material-symbols-outlined">arrow_upward</span>
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.input-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-primary);
		border-radius: 24px;
		background: white;
		transition: border-color 0.2s;
	}

	.input-wrapper:focus-within {
		border-color: var(--color-primary-80);
		box-shadow: 0 0 0 2px var(--color-primary-20);
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
	}

	.input-text {
		flex: 1;
		min-width: 100%;
	}

	.input-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.input-action-button {
		padding: 0.5rem 0.375rem;
	}

	.input-action-button.send {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		transition: background-color 0.2s;
		justify-content: center;
	}

	.grow-wrap {
		flex: 1;
		display: grid;
		padding: 0.5rem 0;
	}

	.grow-wrap::after {
		content: attr(data-replicated-value) " ";
		white-space: pre-wrap;
		visibility: hidden;
		max-height: 8rem;
	}

	.grow-wrap > textarea,
	.grow-wrap::after {
		font: inherit;
		grid-area: 1 / 1 / 2 / 2;
		border: none;
		outline: none;
		resize: none;
		background: transparent;
		max-height: 8rem;
		overflow-y: auto;
	}

	.grow-wrap > textarea::placeholder {
		color: var(--color-primary-70);
	}

	@media (min-width: 40rem) {
		.input-text {
			min-width: auto;
		}
		.input-actions {
			order: -1;
		}
	}
</style>
