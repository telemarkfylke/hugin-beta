<script lang="ts">
	import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi"
	import type { StoreResponse } from "$lib/ragservice/types"
	import "./ragservice-shared.css"

	const api = new RagServiceApi()

	type Props = {
		store: StoreResponse
	}
	let { store }: Props = $props()

	type KVPair = { key: string; value: string }

	let newChunkText: string = $state("")
	let newChunkFields: KVPair[] = $state([])
	let adding: boolean = $state(false)
	let successMessage: string = $state("")

	function addField() {
		newChunkFields.push({ key: "", value: "" })
	}

	function removeField(index: number) {
		newChunkFields.splice(index, 1)
	}

	function buildExtraInfo(): Record<string, unknown> | undefined {
		const filled = newChunkFields.filter((f) => f.key.trim())
		if (filled.length === 0) return undefined
		return Object.fromEntries(filled.map((f) => [f.key.trim(), f.value]))
	}

	async function addChunk() {
		if (!newChunkText.trim()) return
		adding = true
		successMessage = ""
		try {
			await api.addChunks(store.storeId, [{ data: newChunkText, extraInfo: buildExtraInfo() }])
			newChunkText = ""
			newChunkFields = []
			successMessage = "Chunk lagt til."
		} finally {
			adding = false
		}
	}
</script>

<div class="rag-card chunks-form">
	<textarea rows="6" bind:value={newChunkText} placeholder="Skriv inn tekst for ny chunk..."></textarea>

	<div class="extra-info">
		<span class="extra-info-label">Ekstra felt (valgfritt)</span>
		{#each newChunkFields as field, i}
			<div class="kv-row">
				<input type="text" placeholder="Nøkkel" bind:value={field.key} />
				<input type="text" placeholder="Verdi" bind:value={field.value} />
				<button type="button" class="icon-button" onclick={() => removeField(i)} title="Fjern felt">
					<span class="material-symbols-outlined">close</span>
				</button>
			</div>
		{/each}
		<button type="button" class="add-field-btn" onclick={addField}>
			<span class="material-symbols-outlined">add</span> Legg til felt
		</button>
	</div>

	<div class="form-actions">
		<button class="filled" onclick={addChunk} disabled={adding || !newChunkText.trim()}>
			{adding ? "Legger til..." : "Legg til chunk"}
		</button>
		{#if successMessage}
			<span class="success">{successMessage}</span>
		{/if}
	</div>
</div>

<style>
	div.chunks-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 600px;
	}

	div.chunks-form textarea {
		font: inherit;
		padding: 8px;
		border: 1px solid var(--color-primary-30);
		border-radius: 4px;
	}

	div.extra-info {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	span.extra-info-label {
		font-size: small;
		color: #666;
	}

	div.kv-row {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	div.kv-row input {
		flex: 1;
		font-family: var(--font-family);
		padding: 4px 6px;
		border: 1px solid var(--color-primary-30);
		border-radius: 4px;
	}

	button.add-field-btn {
		align-self: flex-start;
		height: auto;
		font-size: small;
		background: none;
		border: 1px dashed var(--color-primary-30);
		color: var(--color-primary);
		cursor: pointer;
		padding: 4px 8px;
	}

	div.form-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	span.success {
		font-size: small;
		color: var(--color-primary);
	}
</style>
