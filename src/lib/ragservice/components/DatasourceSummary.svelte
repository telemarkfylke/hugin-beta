<script lang="ts">
	import { approximatePages } from "../file-usage"

	/**
	 * What the bot actually gets from its ragservice datasources, all of them together - the size limit is per bot,
	 * so which files fit depends on the combination, not on one datasource alone. Computed server-side by the same
	 * planner the chat uses (/api/datasources/rag-summary), so this can't drift from what the chat does.
	 */
	type Props = {
		storeIds: string[]
		/** The bot can be used without login - whole documents attached to it are then readable by anyone */
		allowAnonymousEmbed: boolean
	}

	type Summary = {
		maxCharacters: number
		attached: { name: string; characters: number }[]
		omitted: { name: string; characters: number; searchedInstead: boolean }[]
		searchedFiles: number
		disabledFiles: number
		unreadableStoreIds: string[]
	}

	let { storeIds, allowAnonymousEmbed }: Props = $props()

	let summary = $state<Summary | null>(null)
	let loading = $state(false)
	let failed = $state(false)

	// Only the latest request may set the result - adding two datasources quickly must not end on the older answer
	let requestNumber = 0
	const storeKey = $derived(storeIds.join(","))

	$effect(() => {
		const key = storeKey
		if (!key) {
			summary = null
			return
		}
		const thisRequest = ++requestNumber
		loading = true
		failed = false
		fetch(`/api/datasources/rag-summary?storeIds=${encodeURIComponent(key)}`)
			.then(async (res) => {
				if (!res.ok) throw new Error(String(res.status))
				return (await res.json()) as Summary
			})
			.then((result) => {
				if (thisRequest === requestNumber) summary = result
			})
			.catch(() => {
				if (thisRequest === requestNumber) failed = true
			})
			.finally(() => {
				if (thisRequest === requestNumber) loading = false
			})
	})

	const pages = (characters: number) => `ca. ${approximatePages(characters)} ${approximatePages(characters) === 1 ? "side" : "sider"}`
	const files = (count: number) => `${count} ${count === 1 ? "fil" : "filer"}`

	let attachedCharacters = $derived(summary?.attached.reduce((sum, file) => sum + file.characters, 0) ?? 0)
	let leftOut = $derived(summary?.omitted.filter((file) => !file.searchedInstead) ?? [])
	let searchedInstead = $derived(summary?.omitted.filter((file) => file.searchedInstead) ?? [])
	let nothingUsed = $derived(summary !== null && summary.attached.length === 0 && summary.searchedFiles === 0 && summary.unreadableStoreIds.length < storeIds.length)
</script>

{#if storeIds.length > 0}
	<div class="rag-summary" aria-live="polite">
		{#if failed}
			<div class="line muted">Kunne ikke hente oversikt over hva boten får fra dokumentsøk.</div>
		{:else if !summary}
			<div class="line muted">{loading ? "Henter oversikt…" : ""}</div>
		{:else}
			<div class="title">Dette får boten fra dokumentsøk</div>

			{#if summary.attached.length > 0}
				<div class="line" title={summary.attached.map((file) => `${file.name} (${pages(file.characters)})`).join("\n")}>
					<span class="material-symbols-outlined">description</span>
					<span>
						<strong>Legges ved hele:</strong> {summary.attached.length} {summary.attached.length === 1 ? "dokument" : "dokumenter"}, {pages(attachedCharacters)}
						<span class="muted">(av maks {pages(summary.maxCharacters)})</span>
					</span>
				</div>
			{/if}

			{#if summary.searchedFiles > 0}
				<div class="line">
					<span class="material-symbols-outlined">search</span>
					<span><strong>Søkes i:</strong> {files(summary.searchedFiles)} - de mest relevante utdragene hentes for hvert spørsmål</span>
				</div>
			{/if}

			{#if searchedInstead.length > 0}
				<div class="line">
					<span class="material-symbols-outlined">info</span>
					<span>
						<strong>For store til å legges ved, søkes i i stedet:</strong>
						{searchedInstead.map((file) => `${file.name} (${pages(file.characters)})`).join(", ")}
					</span>
				</div>
			{/if}

			{#if summary.disabledFiles > 0}
				<div class="line muted">
					<span class="material-symbols-outlined">block</span>
					<span>Ikke i bruk: {files(summary.disabledFiles)} (Deaktivert)</span>
				</div>
			{/if}

			{#if leftOut.length > 0}
				<div class="line warning">
					<span class="material-symbols-outlined">warning</span>
					<span>
						<strong>Kommer ikke med</strong> (for store til grensen på {pages(summary.maxCharacters)}):
						{leftOut.map((file) => `${file.name} (${pages(file.characters)})`).join(", ")}.
						Boten sier fra til brukeren at disse mangler. Gjør dem søkbare, eller bruk færre eller mindre dokumenter som Fil-innhold.
					</span>
				</div>
			{/if}

			{#if nothingUsed}
				<div class="line warning">
					<span class="material-symbols-outlined">warning</span>
					<span><strong>Boten får ingenting fra dokumentsøk:</strong> ingen filer er satt til Fil-innhold eller Søk. Velg bruk per fil i datakildens filliste.</span>
				</div>
			{/if}

			{#if allowAnonymousEmbed && summary.attached.length > 0}
				<div class="line warning">
					<span class="material-symbols-outlined">public</span>
					<span><strong>Boten kan brukes uten innlogging:</strong> hele innholdet i dokumentene som legges ved, kan i praksis hentes ut av hvem som helst.</span>
				</div>
			{/if}

			{#if summary.unreadableStoreIds.length > 0}
				<div class="line muted">
					<span class="material-symbols-outlined">help</span>
					<span>
						{summary.unreadableStoreIds.length === 1 ? "Én datakilde" : `${summary.unreadableStoreIds.length} datakilder`} kunne ikke leses med din tilgang, og er ikke med i oversikten. Boten søker likevel i dem for brukere som har tilgang.
					</span>
				</div>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.rag-summary {
		margin-top: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-primary-20);
		border-radius: 0.5rem;
		font-size: small;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.title {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-primary);
		opacity: 0.75;
	}
	.line {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
	}
	.line .material-symbols-outlined {
		font-size: 1rem;
		line-height: 1.25rem;
	}
	.muted {
		color: #888;
	}
	.warning {
		color: #a15c00;
	}
</style>
