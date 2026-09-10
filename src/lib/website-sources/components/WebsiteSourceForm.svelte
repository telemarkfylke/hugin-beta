<script lang="ts">
	import type { WebsiteSource, WebsiteSourceEntry } from "$lib/types/website-source"
	import { WebsiteSourcesApi } from "$lib/website-sources/adapters/websiteSourcesApi"
	import "$lib/ragservice/components/ragservice-shared.css"

	type Props = {
		source: WebsiteSource | null // null = creating a new source
		onDone: (result: WebsiteSource | null) => void
	}
	let { source, onDone }: Props = $props()

	let name = $state(source?.name ?? "")
	let entries: WebsiteSourceEntry[] = $state(source ? source.entries.map((e) => ({ ...e })) : [{ value: "", matchType: "exact" }])

	const api = new WebsiteSourcesApi()

	let saving = $state(false)
	let saveError: string | null = $state(null)

	function addEntry() {
		entries.push({ value: "", matchType: "exact" })
	}

	function removeEntry(index: number) {
		entries.splice(index, 1)
	}

	async function save() {
		saving = true
		saveError = null
		try {
			const input = { name: name.trim(), entries: entries.filter((e) => e.value.trim()).map((e) => ({ value: e.value.trim(), matchType: e.matchType })) }
			if (input.entries.length === 0) {
				saveError = "Legg til minst én URL."
				return
			}
			const result = source ? await api.updateSource(source._id, input) : await api.createSource(input)
			if (result) {
				onDone(result)
			} else {
				saveError = "Kunne ikke lagre kilden. Sjekk at alle URL-er er gyldige (http/https)."
			}
		} finally {
			saving = false
		}
	}

	function cancel() {
		onDone(null)
	}
</script>

<main class="rag-card">
	<h3 class="rag-section-title">Kilde</h3>
	<div class="rag-field-grid">
		<div class="rag-simple-field">
			<span class="rag-field-label">Navn</span>
			<input type="text" bind:value={name} placeholder="F.eks. Farte.no - Kollektivtransport" />
		</div>
	</div>

	<h3 class="rag-section-title">
		URL-er
		<span class="rag-muted">Eksakt = kun denne siden. Prefiks = alt under denne adressen (kan brukes for et helt domene).</span>
	</h3>
	<div class="entry-rows">
		{#each entries as entry, i}
			<div class="entry-row">
				<input type="text" placeholder="https://eksempel.no/side" bind:value={entry.value} />
				<select bind:value={entry.matchType}>
					<option value="exact">Eksakt side</option>
					<option value="prefix">Prefiks (seksjon/domene)</option>
				</select>
				<button type="button" class="icon-button" onclick={() => removeEntry(i)} title="Fjern URL" disabled={entries.length === 1}>
					<span class="material-symbols-outlined">close</span>
				</button>
			</div>
		{/each}
		<button type="button" class="add-entry-btn" onclick={addEntry}>
			<span class="material-symbols-outlined">add</span> Legg til URL
		</button>
	</div>

	<div class="actions">
		<button onclick={cancel} disabled={saving}>Avbryt</button>
		<button class="filled" onclick={save} disabled={saving}>{saving ? "Lagrer..." : "Lagre"}</button>
	</div>

	{#if saveError}
		<p class="error">{saveError}</p>
	{/if}
</main>

<style>
	.entry-rows {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.entry-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.entry-row input[type="text"] {
		flex: 1;
	}

	button.add-entry-btn {
		align-self: flex-start;
		height: auto;
		font-size: small;
		background: none;
		border: 1px dashed var(--color-primary-30);
		color: var(--color-primary);
		cursor: pointer;
		padding: 4px 8px;
	}

	div.actions {
		display: flex;
		gap: 8px;
		margin-top: 20px;
	}

	p.error {
		color: var(--color-danger);
		margin-top: 12px;
	}

	.rag-section-title .rag-muted {
		display: block;
		text-transform: none;
		font-weight: 400;
		letter-spacing: normal;
		font-size: 0.8rem;
		margin-top: 4px;
	}
</style>
