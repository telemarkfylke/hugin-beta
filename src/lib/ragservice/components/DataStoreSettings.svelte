<script lang="ts">
	import { RagServiceApi } from "../adapters/ragserviceApi"
	import type { StoreResponse, UpdateStoreValues } from "../types"

	type Props = {
		store: StoreResponse
		onSaved: () => void
	}
	let { store, onSaved }: Props = $props()

	const api = new RagServiceApi()

	let name = $state(store.name)
	let description = $state(store.description)

	let useWeights = $state(store.searchOptions?.weights != null)
	let weightsText = $state(store.searchOptions?.weights?.text ?? 0.5)

	let useThresholds = $state(store.searchOptions?.thresholds != null)
	let thresholdsText = $state(store.searchOptions?.thresholds?.text ?? 0)
	let thresholdsVector = $state(store.searchOptions?.thresholds?.vector ?? 0.7)
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
				weights: useWeights ? { text: weightsText, vector: 1 - weightsText } : null,
				thresholds: useThresholds ? { text: thresholdsText, vector: thresholdsVector, logic: thresholdsLogic } : null
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
				<td colspan="3">
					<label><input type="checkbox" bind:checked={useWeights} /> Egendefinert vekting</label>
				</td>
			</tr>
			{#if useWeights}
				<tr>
					<td>Vector &lt;-&gt; Tekst</td>
					<td>{(1 - weightsText).toFixed(1)} / {weightsText.toFixed(1)}</td>
					<td><input type="range" step="0.1" min="0" max="1" bind:value={weightsText} /></td>
				</tr>
			{/if}

			<tr>
				<td colspan="3">
					<label><input type="checkbox" bind:checked={useThresholds} /> Egendefinerte terskler</label>
				</td>
			</tr>
			{#if useThresholds}
				<tr>
					<td>Text Treshhold</td>
					<td>{thresholdsText}</td>
					<td><input type="range" step="1" min="0" max="50" bind:value={thresholdsText} /></td>
				</tr>
				<tr>
					<td>Vector Treshhold</td>
					<td>{thresholdsVector}</td>
					<td><input type="range" step="0.01" min="0" max="1" bind:value={thresholdsVector} /></td>
				</tr>
				<tr>
					<td>Logikk</td>
					<td colspan="2">
						<select bind:value={thresholdsLogic}>
							<option value="or">Eller (or)</option>
							<option value="and">Og (and)</option>
						</select>
					</td>
				</tr>
			{/if}
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
