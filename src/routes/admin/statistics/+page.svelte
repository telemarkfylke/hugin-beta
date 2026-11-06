<script lang="ts">
	import { invalidateAll } from "$app/navigation"
	import type { UsageBucket } from "$lib/usagebudget/types"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()

	// Rough kroner, only as a reading aid next to the USD values
	const NOK_PER_USD = 10.5

	let refreshing = $state(false)

	const usd = (value: number) => value.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
	const bound = (value: number) => value.toLocaleString("nb-NO", { maximumFractionDigits: 2 })
	const nok = (value: number) => `≈ ${Math.round(value * NOK_PER_USD).toLocaleString("nb-NO")} kr`
	const bucketLabel = (bucket: UsageBucket) => (bucket.toUsd === null ? `${bound(bucket.fromUsd)}+ USD` : `${bound(bucket.fromUsd)}–${bound(bucket.toUsd)} USD`)

	// Empty buckets are left out - several sit above what any budget even allows
	const usedBuckets = $derived(data.usage?.users.buckets.filter((b) => b.count > 0) ?? [])
	const maxCount = $derived(Math.max(1, ...usedBuckets.map((b) => b.count)))

	const refresh = async () => {
		refreshing = true
		try {
			await invalidateAll()
		} finally {
			refreshing = false
		}
	}
</script>

<div class="statistics-page">
	<h1>Statistikk</h1>

	{#if data.usage}
		{@const usage = data.usage}
		<p class="intro">
			KI-forbruk i dag, siden {new Date(usage.since).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })} (døgnet følger UTC). Bare chat og kladdebok teller - en som bare har åpnet
			Hugin uten å spørre om noe, er ikke med. Beløpene er i USD, beregnet med prisene på
			<a href="/admin/ratelimits">Forbruk og priser</a>.
		</p>

		<div class="tiles">
			<div class="tile">
				<span class="tile-label">Brukere med KI-bruk i dag</span>
				<span class="tile-value">{usage.users.active.toLocaleString("nb-NO")}</span>
			</div>
			<div class="tile">
				<span class="tile-label">Forbruk i dag</span>
				<span class="tile-value">{usd(usage.users.totalUsd)} <span class="tile-unit">USD</span></span>
				<span class="tile-sub">{nok(usage.users.totalUsd)}</span>
			</div>
			<div class="tile">
				<span class="tile-label">Anonymt innebygde assistenter</span>
				<span class="tile-value">{usd(usage.anonymousEmbedBots.totalUsd)} <span class="tile-unit">USD</span></span>
				<span class="tile-sub">{usage.anonymousEmbedBots.active} {usage.anonymousEmbedBots.active === 1 ? "assistent" : "assistenter"} i bruk</span>
			</div>
		</div>

		<section>
			<div class="section-head">
				<h2>Brukere fordelt på forbruk i dag</h2>
				<button type="button" onclick={refresh} disabled={refreshing}>{refreshing ? "Oppdaterer..." : "Oppdater"}</button>
			</div>
			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th scope="col">Forbruk per bruker</th>
							<th scope="col" class="bar-col">Brukere</th>
							<th scope="col" class="num">Sum USD</th>
						</tr>
					</thead>
					<tbody>
						{#if usedBuckets.length === 0 && usage.users.negative.count === 0}
							<tr>
								<td colspan="3" class="empty">Ingen KI-bruk registrert i dag ennå.</td>
							</tr>
						{/if}
						{#each usedBuckets as bucket (bucket.fromUsd)}
							<tr title={`${bucketLabel(bucket)}: ${bucket.count} brukere, ${usd(bucket.totalUsd)} USD til sammen`}>
								<th scope="row">{bucketLabel(bucket)}</th>
								<td class="bar-col">
									<div class="bar-cell">
										<div class="bar-track">
											<div class="bar" style:width={`${(bucket.count / maxCount) * 100}%`}></div>
										</div>
										<span class="bar-value">{bucket.count.toLocaleString("nb-NO")}</span>
									</div>
								</td>
								<td class="num">{usd(bucket.totalUsd)}</td>
							</tr>
						{/each}
						{#if usage.users.negative.count > 0}
							<tr class="negative" title="Avregninger som landet like etter at døgnet rullet - støy, ikke forbruk">
								<th scope="row">Negativ (avregning over døgnskiftet)</th>
								<td class="bar-col"><span class="bar-value">{usage.users.negative.count}</span></td>
								<td class="num">{usd(usage.users.negative.totalUsd)}</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>

<style>
	.statistics-page {
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
		margin: 0;
	}

	.intro {
		max-width: 75ch;
		margin-bottom: 1.5rem;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--color-primary-20);
		border-radius: 8px;
	}

	.tile-label,
	.tile-sub {
		font-size: 0.85rem;
		color: var(--color-primary-80);
	}

	.tile-value {
		font-size: 2rem;
		font-weight: 600;
		color: var(--color-primary);
		font-variant-numeric: tabular-nums;
	}

	.tile-unit {
		font-size: 1rem;
		font-weight: 400;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
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
		padding: 0.45rem 0.75rem;
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
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.bar-col {
		width: 60%;
	}

	.bar-cell {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.bar-track {
		flex: 1;
		min-width: 4rem;
	}

	.bar {
		height: 14px;
		min-width: 3px;
		background: var(--color-primary);
		border-radius: 0 4px 4px 0;
	}

	.bar-value {
		min-width: 2.5rem;
		font-variant-numeric: tabular-nums;
	}

	.empty {
		color: var(--color-primary-80);
		font-style: italic;
	}

	tr.negative {
		color: var(--color-primary-80);
		font-style: italic;
	}

	@media (max-width: 768px) {
		.statistics-page {
			padding: 0.75rem;
		}

		.bar-col {
			width: auto;
		}
	}
</style>
