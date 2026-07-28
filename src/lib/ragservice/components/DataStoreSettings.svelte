<script lang="ts">
	import { RagServiceApi } from "../adapters/ragserviceApi"
	import type { StoreResponse, UpdateStoreValues } from "../types"
	import NullableRangeField from "./NullableRangeField.svelte"

	type Props = {
		store: StoreResponse
		onSaved: () => void
	}
	let { store, onSaved }: Props = $props()

	const api = new RagServiceApi()

	let name = $state(store.name)
	let description = $state(store.description)

	let weightsText: number = $state(store.searchOptions?.weights?.text ?? 0.5)

	let thresholdsText: number | null = $state(store.searchOptions?.thresholds?.text ?? null)
	let thresholdsVector: number | null = $state(store.searchOptions?.thresholds?.vector ?? null)
	let thresholdsLogic: "and" | "or" = $state(store.searchOptions?.thresholds?.logic ?? "or")

	let saving = $state(false)
	let saveError: string | null = $state(null)

	async function save() {
		saving = true
		saveError = null
		const values: UpdateStoreValues = {
			name,
			description,
			searchOptions: {
				weights: { text: weightsText, vector: 1 - weightsText },
				thresholds: { text: thresholdsText, vector: thresholdsVector, logic: thresholdsLogic }
			}
		}
		try {
			const updated = await api.updateStore(store.storeId, values)
			if (updated) {
				onSaved()
			} else {
				saveError = "Kunne ikke lagre innstillinger"
			}
		} finally {
			saving = false
		}
	}
</script>

<main>
	<table>
		<tbody>
			<tr><td>Navn</td><td>:</td><td><input bind:value={name} /></td></tr>
			<tr><td>Beskrivelse</td><td>:</td><td><input bind:value={description} /></td></tr>

			<tr>
				<td>Vector &lt;-&gt; Tekst</td>
				<td>{(1 - weightsText).toFixed(1)} / {weightsText.toFixed(1)}</td>
				<td><input type="range" step="0.1" min="0" max="1" bind:value={weightsText} /></td>
			</tr>

			<NullableRangeField label="Text Treshhold" min={0} max={50} step={1} bind:value={thresholdsText} />
			<NullableRangeField label="Vector Treshhold" min={0} max={1} step={0.01} decimals={2} bind:value={thresholdsVector} />

			<tr>
				<td>Logikk</td>
				<td colspan="2">
					<select bind:value={thresholdsLogic}>
						<option value="and">And</option>
						<option value="or">Or</option>
					</select>
				</td>
			</tr>
		</tbody>
	</table>

	{#if saveError}
		<p class="error">{saveError}</p>
	{/if}

	<div class="actions">
		<button onclick={() => save()} disabled={saving}>Lagre</button>
	</div>
</main>

<style>
	div.actions {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}

	p.error {
		color: #c00;
	}
</style>
