<script lang="ts">
	import type { CategoryCount, CategoryDateCount, UncategorizedSample } from "$lib/statsstore/types"
	import { FALLBACK_CATEGORY } from "$lib/statsstore/types"

	type Props = {
		chatConfigId: string
		categories: string[]
	}

	let { chatConfigId, categories }: Props = $props()

	const toDateInputValue = (d: Date): string => d.toISOString().slice(0, 10)

	let today = new Date()
	let from = $state(toDateInputValue(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)))
	let to = $state(toDateInputValue(today))

	let totals: CategoryCount[] = $state([])
	let totalsLoading = $state(false)
	let totalsError = $state<string | null>(null)

	let selectedCategory = $state<string>("")
	let trend: CategoryDateCount[] = $state([])
	let trendLoading = $state(false)
	let trendError = $state<string | null>(null)
	// Only ever populated when selectedCategory === FALLBACK_CATEGORY - see UncategorizedSample for
	// why this is a raw sampled list, not something folded into `trend`/`totals`.
	let uncategorizedSamples: UncategorizedSample[] = $state([])

	// Whole-day range in UTC - "to" is a plain date (no time-of-day), so without this the last day
	// in the range would be excluded entirely (its events all fall after 00:00:00 that day).
	const rangeParams = () => {
		const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString()
		const toIso = new Date(`${to}T23:59:59.999Z`).toISOString()
		return { fromIso, toIso }
	}

	let exporting = $state(false)
	let exportError = $state<string | null>(null)

	// Downloads the same data as this whole tab (totals + a per-category trend sheet each +
	// Ukategorisert samples), as a real .xlsx built server-side - see the export route for the sheet
	// layout. Uses the same fetch-then-Blob-download pattern as NewChatMenu.svelte's .kráa export.
	async function exportToExcel() {
		exporting = true
		exportError = null
		try {
			const { fromIso, toIso } = rangeParams()
			const res = await fetch(`/api/chatconfigs/${chatConfigId}/stats/export?${new URLSearchParams({ from: fromIso, to: toIso })}`)
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

			const blob = await res.blob()
			const url = URL.createObjectURL(blob)
			const contentDisposition = res.headers.get("Content-Disposition")
			const fileName = contentDisposition?.match(/filename="(.+)"/)?.[1] ?? "statistikk.xlsx"

			const a = document.createElement("a")
			a.href = url
			a.download = fileName
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)
		} catch (error) {
			console.error("Error exporting stats to Excel:", error)
			exportError = "Kunne ikke eksportere statistikken."
		} finally {
			exporting = false
		}
	}

	async function loadTotals() {
		totalsLoading = true
		totalsError = null
		try {
			const { fromIso, toIso } = rangeParams()
			const res = await fetch(`/api/chatconfigs/${chatConfigId}/stats?${new URLSearchParams({ from: fromIso, to: toIso })}`)
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
			const data = await res.json()
			totals = data.stats
		} catch (error) {
			console.error("Error loading category stats:", error)
			totalsError = "Kunne ikke hente statistikk."
		} finally {
			totalsLoading = false
		}
	}

	async function loadTrend() {
		if (!selectedCategory) {
			trend = []
			uncategorizedSamples = []
			return
		}
		trendLoading = true
		trendError = null
		try {
			const { fromIso, toIso } = rangeParams()
			const res = await fetch(`/api/chatconfigs/${chatConfigId}/stats?${new URLSearchParams({ from: fromIso, to: toIso, category: selectedCategory })}`)
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
			const data = await res.json()
			trend = data.stats
			uncategorizedSamples = selectedCategory === FALLBACK_CATEGORY ? (data.samples ?? []) : []
		} catch (error) {
			console.error("Error loading category trend:", error)
			trendError = "Kunne ikke hente utvikling."
		} finally {
			trendLoading = false
		}
	}

	$effect(() => {
		from
		to
		loadTotals()
	})
	$effect(() => {
		from
		to
		selectedCategory
		loadTrend()
	})

	let maxTotal = $derived(Math.max(1, ...totals.map((t) => t.count)))

	// Compact SVG line chart for one category's daily counts - see references in dataviz skill:
	// 2px round-cap line, ~10% opacity area wash, >=8px endpoint marker with a 2px surface ring,
	// direct label only at the endpoint (not on every point).
	const CHART_WIDTH = 320
	const CHART_HEIGHT = 90
	const CHART_PAD = 6
	let trendPoints = $derived.by(() => {
		if (trend.length === 0) return []
		const maxCount = Math.max(1, ...trend.map((t) => t.count))
		const stepX = trend.length > 1 ? (CHART_WIDTH - CHART_PAD * 2) / (trend.length - 1) : 0
		return trend.map((t, i) => ({
			x: CHART_PAD + i * stepX,
			y: CHART_HEIGHT - CHART_PAD - (t.count / maxCount) * (CHART_HEIGHT - CHART_PAD * 2),
			...t
		}))
	})
	let trendLinePath = $derived(trendPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" "))
	let trendAreaPath = $derived(
		trendPoints.length > 0 ? `${trendLinePath} L ${trendPoints[trendPoints.length - 1]?.x} ${CHART_HEIGHT - CHART_PAD} L ${trendPoints[0]?.x} ${CHART_HEIGHT - CHART_PAD} Z` : ""
	)
</script>

<div class="config-section stats-section">
	<div class="config-item">
		<label for="stats-from">Statistikk - spørsmål per kategori</label>
		<div class="date-range">
			<input id="stats-from" type="date" bind:value={from} max={to} />
			<span>til</span>
			<input id="stats-to" type="date" bind:value={to} min={from} max={toDateInputValue(today)} />
			<button onclick={exportToExcel} disabled={exporting} title="Last ned all statistikk for perioden som Excel-fil">
				<span class="material-symbols-outlined">download</span>
				{exporting ? "Eksporterer..." : "Eksporter til Excel"}
			</button>
		</div>
		{#if exportError}
			<div class="stats-hint error">{exportError}</div>
		{/if}

		{#if totalsLoading}
			<div class="stats-hint">Henter statistikk...</div>
		{:else if totalsError}
			<div class="stats-hint error">{totalsError}</div>
		{:else if totals.length === 0}
			<div class="stats-hint">Ingen spørsmål registrert i denne perioden.</div>
		{:else}
			<div class="bar-chart" role="table" aria-label="Antall spørsmål per kategori">
				{#each totals as stat (stat.category)}
					<div class="bar-row" role="row">
						<span class="bar-label" role="cell">{stat.category}</span>
						<div class="bar-track" role="cell">
							<div class="bar-fill" style="width: {(stat.count / maxTotal) * 100}%"></div>
						</div>
						<span class="bar-value" role="cell">{stat.count}</span>
					</div>
				{/each}
			</div>
		{/if}

		{#if categories.length > 0}
			<div class="trend-picker">
				<label for="trend-category">Utvikling over tid for kategori</label>
				<select id="trend-category" bind:value={selectedCategory}>
					<option value="">Velg kategori...</option>
					{#each categories as category}
						<option value={category}>{category}</option>
					{/each}
					<option value={FALLBACK_CATEGORY}>{FALLBACK_CATEGORY}</option>
				</select>
			</div>

			{#if selectedCategory}
				{#if trendLoading}
					<div class="stats-hint">Henter utvikling...</div>
				{:else if trendError}
					<div class="stats-hint error">{trendError}</div>
				{:else if trend.length === 0}
					<div class="stats-hint">Ingen data for «{selectedCategory}» i denne perioden.</div>
				{:else}
					<svg class="trend-chart" viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}" role="img" aria-label="Utvikling for {selectedCategory}">
						<line x1={CHART_PAD} y1={CHART_HEIGHT - CHART_PAD} x2={CHART_WIDTH - CHART_PAD} y2={CHART_HEIGHT - CHART_PAD} class="trend-baseline" />
						<path d={trendAreaPath} class="trend-area" />
						<path d={trendLinePath} class="trend-line" />
						{#if trendPoints.length > 0}
							{@const last = trendPoints[trendPoints.length - 1]}
							{#if last}
								<circle cx={last.x} cy={last.y} r="4" class="trend-endpoint" />
								<text x={last.x} y={last.y - 8} class="trend-endpoint-label" text-anchor="end">{last.count}</text>
							{/if}
						{/if}
					</svg>
					<div class="trend-range-labels">
						<span>{trend[0]?.date}</span>
						<span>{trend[trend.length - 1]?.date}</span>
					</div>
				{/if}

				<!-- Raw sampled AI-guessed topics, not a count - see UncategorizedSample. Helps a bot
				     author spot unanticipated question types without any real question content stored. -->
				{#if selectedCategory === FALLBACK_CATEGORY}
					<div class="uncategorized-samples">
						<span class="uncategorized-samples-label">Temaer i «{FALLBACK_CATEGORY}» i valgt periode (KI-gjettet, ikke eksakt spørsmålstekst)</span>
						{#if uncategorizedSamples.length === 0}
							<div class="stats-hint">Ingen eksempler tilgjengelig for denne perioden.</div>
						{:else}
							<ul>
								{#each uncategorizedSamples as sample, i (i)}
									<li>{sample.suggestedTopic}</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			{/if}
		{/if}
	</div>
</div>

<style>
	.stats-section {
		flex-direction: column;
	}
	.date-range {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: small;
		margin-bottom: 0.75rem;
	}
	.date-range input[type="date"] {
		width: auto;
	}
	.stats-hint {
		font-size: smaller;
		color: #888;
		padding: 0.5rem 0;
	}
	.stats-hint.error {
		color: var(--color-danger);
	}
	.bar-chart {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.bar-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: small;
	}
	.bar-label {
		flex: 0 0 auto;
		width: 9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar-track {
		flex: 1;
		background-color: var(--color-primary-10);
		border-radius: 4px;
		height: 16px;
	}
	.bar-fill {
		height: 100%;
		min-width: 4px;
		background-color: var(--color-primary);
		border-radius: 0 4px 4px 0;
	}
	.bar-value {
		flex: 0 0 auto;
		width: 2.5rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: var(--color-primary);
	}
	.trend-picker {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.trend-picker label {
		padding-bottom: 0;
		white-space: nowrap;
	}
	.trend-picker select {
		width: auto;
	}
	.trend-chart {
		width: 100%;
		max-width: 24rem;
		margin-top: 0.5rem;
	}
	.trend-baseline {
		stroke: var(--color-primary-20);
		stroke-width: 1;
	}
	.trend-area {
		fill: var(--color-primary);
		fill-opacity: 0.1;
		stroke: none;
	}
	.trend-line {
		fill: none;
		stroke: var(--color-primary);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.trend-endpoint {
		fill: var(--color-primary);
		stroke: white;
		stroke-width: 2;
	}
	.trend-endpoint-label {
		font-size: 10px;
		fill: var(--color-primary);
	}
	.trend-range-labels {
		display: flex;
		justify-content: space-between;
		max-width: 24rem;
		font-size: smaller;
		color: #888;
	}
	.uncategorized-samples {
		margin-top: 1rem;
		max-width: 24rem;
	}
	.uncategorized-samples-label {
		font-size: smaller;
		color: #888;
	}
	.uncategorized-samples ul {
		margin: 0.4rem 0 0;
		padding-left: 1.1rem;
		font-size: small;
		max-height: 14rem;
		overflow-y: auto;
	}
	.uncategorized-samples li {
		padding: 0.15rem 0;
	}
</style>
