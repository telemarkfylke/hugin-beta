<script lang="ts">
	import { MAX_ARMED_ATTACHMENTS } from "$lib/chat-history"
	import type { ChatState } from "./ChatState.svelte"

	type Props = {
		chatState: ChatState
	}

	let { chatState }: Props = $props()

	let armedCount = $derived(chatState.armedAttachmentIds.length)
	let atLimit = $derived(armedCount >= MAX_ARMED_ATTACHMENTS)

	const formatSize = (bytes: number): string => {
		if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	}
</script>

<div class="conversation-attachments">
	<span class="label" title="Bare aktive filer sendes med til modellen. Hver aktiv fil sendes på nytt for hver melding.">
		Filer i samtalen · {armedCount}/{MAX_ARMED_ATTACHMENTS} aktive
	</span>
	<div class="chips">
		{#each chatState.attachments as attachment (attachment.id)}
			{@const armed = chatState.armedAttachmentIds.includes(attachment.id)}
			<button
				type="button"
				class="chip"
				class:armed
				disabled={!armed && atLimit}
				onclick={() => chatState.toggleAttachment(attachment.id)}
				title={armed
					? "Aktiv - sendes med til modellen. Klikk for å slå av."
					: atLimit
						? `Maks ${MAX_ARMED_ATTACHMENTS} filer kan være aktive samtidig`
						: "Ikke aktiv - modellen ser ikke innholdet. Klikk for å slå på."}
			>
				<span class="material-symbols-outlined">{armed ? "check_circle" : attachment.kind === "image" ? "image" : "description"}</span>
				<span class="name">{attachment.name}</span>
				<span class="size">{formatSize(attachment.size)}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.conversation-attachments {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0 0.5rem;
	}

	.label {
		font-size: 0.8rem;
		color: var(--color-primary-70);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		max-width: 16rem;
		padding: 0.2rem 0.6rem 0.2rem 0.4rem;
		font: inherit;
		font-size: 0.8rem;
		color: var(--color-primary-70);
		background: transparent;
		border: 1px dashed var(--color-primary-30);
		border-radius: 999px;
		cursor: pointer;
	}

	.chip .material-symbols-outlined {
		font-size: 1rem;
	}

	.chip.armed {
		color: var(--color-primary);
		background-color: var(--color-primary-20);
		border-style: solid;
		border-color: var(--color-primary);
	}

	.chip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.size {
		opacity: 0.7;
	}
</style>
