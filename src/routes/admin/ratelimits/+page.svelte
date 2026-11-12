<script lang="ts">
	import { AFFILIATIONS } from "$lib/types/authentication"
	import { BRUKERTYPE_LABELS, type ModelPriceEntry, type UpdatedBy, type UsageLimits, type UsageLimitsSettings } from "$lib/usagebudget/types"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()

	// Rough kroner, only as a reading aid next to the USD values
	const NOK_PER_USD = 10.5

	// svelte-ignore state_referenced_locally
	let settings: UsageLimitsSettings | null = $state(data.settings)
	// svelte-ignore state_referenced_locally
	let limits: UsageLimits | null = $state(data.settings ? structuredClone(data.settings.limits) : null)
	let savingLimits = $state(false)
	let limitsMessage = $state("")
	let limitsError = $state("")

	type PriceRow = { input: number | null; output: number | null; entry: ModelPriceEntry | null }
	// svelte-ignore state_referenced_locally
	let priceRows: Record<string, PriceRow> = $state(
		Object.fromEntries(
			data.models.map((m) => {
				const entry = data.prices.find((p) => p.model === m.model) ?? null
				return [m.model, { input: entry?.price.inputPerMillion ?? null, output: entry?.price.outputPerMillion ?? null, entry }]
			})
		)
	)
	let savingPrice: string | null = $state(null)
	let priceError = $state("")

	const activeModels = $derived(data.models.filter((m) => !m.retired))
	const retiredModels = $derived(data.models.filter((m) => m.retired))
	const missingPrices = $derived(activeModels.filter((m) => !priceRows[m.model]?.entry).map((m) => m.model))

	const nok = (usd: number | null | undefined): string => (typeof usd === "number" && Number.isFinite(usd) ? `≈ ${(usd * NOK_PER_USD).toLocaleString("nb-NO", { maximumFractionDigits: 1 })} kr` : "")

	const formatUpdated = (updatedAt: Date | null, updatedBy: UpdatedBy | null): string => {
		if (!updatedAt || !updatedBy) return "Ikke satt"
		return `${updatedBy.name}, ${new Date(updatedAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}`
	}

	const readError = async (response: Response): Promise<string> => {
		const body = await response.json().catch(() => null)
		return body?.message ?? `${response.status}`
	}

	const saveLimits = async () => {
		if (!limits) return
		savingLimits = true
		limitsMessage = ""
		limitsError = ""
		try {
			const body: UsageLimits = {
				...limits,
				// An emptied number field comes back as null - for the per-bot cap that means "off"
				embedRateLimits: { ...limits.embedRateLimits, perBotPerDay: limits.embedRateLimits.perBotPerDay || null }
			}
			const response = await fetch("/api/usage-limits", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
			if (!response.ok) throw new Error(await readError(response))
			settings = await response.json()
			limits = structuredClone($state.snapshot(settings?.limits) ?? limits)
			limitsMessage = "Lagret. Gjelder for alle innen ett minutt."
		} catch (error) {
			limitsError = `Kunne ikke lagre: ${error instanceof Error ? error.message : "ukjent feil"}`
		} finally {
			savingLimits = false
		}
	}

	const savePrice = async (model: string) => {
		const row = priceRows[model]
		if (!row || row.input === null || row.output === null) {
			priceError = `${model}: fyll inn både input- og output-pris`
			return
		}
		savingPrice = model
		priceError = ""
		try {
			const response = await fetch(`/api/usage-limits/prices/${encodeURIComponent(model)}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ inputPerMillion: row.input, outputPerMillion: row.output })
			})
			if (!response.ok) throw new Error(await readError(response))
			row.entry = await response.json()
		} catch (error) {
			priceError = `Kunne ikke lagre prisen for ${model}: ${error instanceof Error ? error.message : "ukjent feil"}`
		} finally {
			savingPrice = null
		}
	}

	const removePrice = async (model: string) => {
		if (!confirm(`Fjerne prisen for ${model}? Modellen telles da som ukjent (dyr) modell mot budsjettet.`)) return
		savingPrice = model
		priceError = ""
		try {
			const response = await fetch(`/api/usage-limits/prices/${encodeURIComponent(model)}`, { method: "DELETE" })
			if (!response.ok) throw new Error(await readError(response))
			priceRows[model] = { input: null, output: null, entry: null }
		} catch (error) {
			priceError = `Kunne ikke fjerne prisen for ${model}: ${error instanceof Error ? error.message : "ukjent feil"}`
		} finally {
			savingPrice = null
		}
	}

	const priceChanged = (row: PriceRow): boolean => row.input !== (row.entry?.price.inputPerMillion ?? null) || row.output !== (row.entry?.price.outputPerMillion ?? null)
</script>

<div class="ratelimits-page">
	<h1>Forbruk og priser</h1>
	<p class="intro">
		Hvor mye KI hver brukertype får bruke, grensene for anonymt innebygde assistenter, og hva hver modell koster. Alle beløp er i USD, som er det leverandørene priser i.
		Verdiene gjelder bare dette miljøet (egen database).
	</p>

	{#if settings && limits}
		<form
			onsubmit={(event) => {
				event.preventDefault()
				saveLimits()
			}}
		>
			{#if settings.fallbackFields.length > 0}
				<p class="warning" role="status">
					Ikke lagret i databasen ennå, bruker nødverdiene fra koden: <strong>{settings.fallbackFields.join(", ")}</strong>. Sjekk tallene og trykk Lagre.
				</p>
			{/if}

			<section>
				<h2>Budsjett per brukertype</h2>
				<p class="hint">Per bruker. Har noen flere brukertyper, gjelder den rauseste. Har de ingen, gjelder elev-budsjettet. Admin-rollen gir ikke ekstra kvote.</p>
				<div class="table-wrapper">
					<table>
						<thead>
							<tr>
								<th scope="col">Brukertype</th>
								<th scope="col">Per time (USD)</th>
								<th scope="col">Per døgn (USD)</th>
							</tr>
						</thead>
						<tbody>
							{#each AFFILIATIONS as affiliation (affiliation)}
								<tr>
									<th scope="row">{BRUKERTYPE_LABELS[affiliation]}</th>
									<td>
										<input type="number" min="0.01" max="100" step="0.01" required bind:value={limits.budgets[affiliation].perHourUsd} aria-label={`${BRUKERTYPE_LABELS[affiliation]} per time`} />
										<span class="nok">{nok(limits.budgets[affiliation].perHourUsd)}</span>
									</td>
									<td>
										<input type="number" min="0.01" max="500" step="0.01" required bind:value={limits.budgets[affiliation].perDayUsd} aria-label={`${BRUKERTYPE_LABELS[affiliation]} per døgn`} />
										<span class="nok">{nok(limits.budgets[affiliation].perDayUsd)}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>

			<section>
				<h2>Anonymt innebygde assistenter</h2>
				<p class="hint">
					Kostnadsbudsjettet gjelder per assistent, delt av alle besøkende. Meldingsgrensene er standardverdier - en assistent kan ha egne verdier i sin konfigurasjon, og de går
					foran.
				</p>
				<div class="fields">
					<label>
						Budsjett per time (USD)
						<input type="number" min="0.01" max="100" step="0.01" required bind:value={limits.anonymousEmbed.perHourUsd} />
						<span class="nok">{nok(limits.anonymousEmbed.perHourUsd)}</span>
					</label>
					<label>
						Budsjett per døgn (USD)
						<input type="number" min="0.01" max="500" step="0.01" required bind:value={limits.anonymousEmbed.perDayUsd} />
						<span class="nok">{nok(limits.anonymousEmbed.perDayUsd)}</span>
					</label>
					<label>
						Meldinger per IP per minutt
						<input type="number" min="1" max="10000" step="1" required bind:value={limits.embedRateLimits.perIpPerMinute} />
					</label>
					<label>
						Meldinger per IP per døgn
						<input type="number" min="1" max="100000" step="1" required bind:value={limits.embedRateLimits.perIpPerDay} />
					</label>
					<label>
						Meldinger per assistent per døgn
						<input type="number" min="1" max="1000000" step="1" placeholder="Av" bind:value={limits.embedRateLimits.perBotPerDay} />
						<span class="nok">Tomt = ingen felles grense (anbefalt)</span>
					</label>
				</div>
			</section>

			<section>
				<h2>Generelt</h2>
				<div class="fields">
					<label>
						Samtidige kall per bruker
						<input type="number" min="1" max="50" step="1" required bind:value={limits.maxConcurrentCalls} />
						<span class="nok">Hvor mange svar en bruker kan ha på vei samtidig</span>
					</label>
					<label>
						Pris per websøk (USD)
						<input type="number" min="0.001" max="1" step="0.001" required bind:value={limits.webSearchCallPriceUsd} />
						<span class="nok">Kommer i tillegg til tokens</span>
					</label>
					<label>
						Fil-innhold per bot (tegn)
						<input type="number" min="1" max="2000000" step="1000" required bind:value={limits.maxFileContentCharacters} />
						<span class="nok">Hvor mye hele filer fra datakilder en bot får per spørsmål. Ca. 3000 tegn per side</span>
					</label>
				</div>
			</section>

			<div class="actions">
				<button type="submit" class="filled" disabled={savingLimits}>{savingLimits ? "Lagrer..." : "Lagre grenser"}</button>
				<span class="updated">Sist endret: {formatUpdated(settings.updatedAt, settings.updatedBy)}</span>
				{#if limitsMessage}<span class="ok" role="status">{limitsMessage}</span>{/if}
				{#if limitsError}<span class="error" role="alert">{limitsError}</span>{/if}
			</div>
		</form>

		<section>
			<h2>Modellpriser</h2>
			<p class="hint">USD per million tokens, rett fra leverandørens prisliste. En modell uten pris telles som en ukjent og bevisst dyr modell mot budsjettet.</p>

			{#if missingPrices.length > 0}
				<p class="warning" role="status">Mangler pris: <strong>{missingPrices.join(", ")}</strong></p>
			{/if}
			{#if data.invalidPrices.length > 0}
				<p class="warning" role="status">Ugyldig pris i databasen (telles som ukjent modell): <strong>{data.invalidPrices.join(", ")}</strong></p>
			{/if}
			{#if priceError}
				<p class="error" role="alert">{priceError}</p>
			{/if}

			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th scope="col">Modell</th>
							<th scope="col">Input / 1M</th>
							<th scope="col">Output / 1M</th>
							<th scope="col">Sist endret</th>
							<th scope="col"><span class="visually-hidden">Handlinger</span></th>
						</tr>
					</thead>
					<tbody>
						{#each [...activeModels, ...retiredModels] as m (m.model)}
							{@const row = priceRows[m.model]}
							{#if row}
								<tr class:retired={m.retired} class:missing={!m.retired && !row.entry}>
									<th scope="row">
										<span class="model-label">{m.model}</span>
										<span class="model-meta">{m.vendor} · {m.providerModel}{m.internal ? " · intern" : ""}{m.retired ? " · pensjonert" : ""}</span>
									</th>
									<td><input type="number" min="0" max="1000" step="0.01" bind:value={row.input} aria-label={`${m.model} input-pris`} /></td>
									<td><input type="number" min="0" max="1000" step="0.01" bind:value={row.output} aria-label={`${m.model} output-pris`} /></td>
									<td class="updated">{row.entry ? formatUpdated(row.entry.updatedAt, row.entry.updatedBy) : "Ingen pris"}</td>
									<td class="row-actions">
										<button type="button" class="filled" disabled={savingPrice !== null || !priceChanged(row)} onclick={() => savePrice(m.model)}>Lagre</button>
										{#if row.entry}
											<button type="button" disabled={savingPrice !== null} onclick={() => removePrice(m.model)}>Fjern</button>
										{/if}
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>

<style>
	.ratelimits-page {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1rem 1.25rem 3rem;
	}

	h1 {
		color: var(--color-primary);
		margin-bottom: 0.5rem;
	}

	h2 {
		color: var(--color-primary);
		font-size: 1.15rem;
		margin: 2rem 0 0.25rem;
	}

	.intro,
	.hint {
		max-width: 75ch;
	}

	.hint {
		font-size: 0.9rem;
		color: var(--color-primary-80);
		margin-bottom: 0.75rem;
	}

	.warning {
		border-left: 4px solid var(--color-danger);
		padding: 0.5rem 0.75rem;
		background: var(--color-primary-10, transparent);
	}

	.error {
		color: var(--color-danger);
		font-weight: 600;
	}

	.ok {
		color: var(--color-primary);
		font-weight: 600;
	}

	.table-wrapper {
		overflow-x: auto;
	}

	table {
		border-collapse: collapse;
		width: 100%;
	}

	th,
	td {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--color-primary-20);
		text-align: left;
		vertical-align: middle;
	}

	thead th {
		color: var(--color-primary);
		font-weight: 600;
		border-bottom: 2px solid var(--color-primary-30);
		white-space: nowrap;
	}

	tbody th {
		font-weight: 400;
	}

	input[type="number"] {
		width: 7rem;
		padding: 0.3rem 0.4rem;
	}

	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 1rem 1.5rem;
	}

	.fields label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 600;
	}

	.nok {
		font-size: 0.8rem;
		font-weight: 400;
		color: var(--color-primary-80);
		margin-left: 0.4rem;
	}

	.fields .nok {
		margin-left: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.model-label {
		display: block;
		font-weight: 600;
	}

	.model-meta,
	.updated {
		font-size: 0.85rem;
		color: var(--color-primary-80);
	}

	.updated {
		white-space: nowrap;
	}

	.row-actions {
		white-space: nowrap;
	}

	.row-actions button + button {
		margin-left: 0.4rem;
	}

	tr.retired {
		opacity: 0.6;
	}

	tr.missing th .model-label {
		color: var(--color-danger);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		.ratelimits-page {
			padding: 0.75rem;
		}
	}
</style>
