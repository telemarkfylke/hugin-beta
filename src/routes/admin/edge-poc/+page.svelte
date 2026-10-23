<script lang="ts">
	import type { PageProps } from "./$types"

	// TEMPORARY: see +page.server.ts
	let { data }: PageProps = $props()
	const r = $derived(data.result)

	const allOk = $derived(Boolean(r.tls?.ok && r.http?.ok))
	const ms = (value: number) => `${value.toFixed(0)} ms`
	const date = (iso: string) => new Date(iso).toLocaleString("nb-NO", { dateStyle: "medium", timeStyle: "short" })
</script>

<div class="edge-poc">
	<header class:ok={allOk} class:fail={!allOk}>
		<span class="badge">{allOk ? "OK" : "FEIL"}</span>
		<div>
			<h1>Hugin → edge-01 over HTTPS</h1>
			<p>
				<code>https://{r.host}</code>
				{#if r.targetIp}
					via <code>{r.targetIp}</code> ({r.ipSource === "query" ? "fra ?ip=" : "fra DNS"})
				{/if}
				· sjekket {date(r.checkedAt)}
			</p>
		</div>
	</header>

	<section class="steps">
		<div class="step" class:ok={r.dns.ok} class:fail={!r.dns.ok}>
			<h2>1. DNS</h2>
			<p class="time">{ms(r.dns.ms)}</p>
			<p>{r.dns.ok ? r.dns.detail : `Navnet slår ikke opp: ${r.dns.detail}`}</p>
			{#if !r.dns.ok}
				<p class="hint">Forventet til DNS-postene er på plass. Test med <code>?ip=</code> og edge-01 sin interne IP.</p>
			{/if}
		</div>

		<div class="step" class:ok={r.tls?.ok} class:fail={r.tls && !r.tls.ok} class:skipped={!r.tls}>
			<h2>2. TCP + TLS</h2>
			{#if r.tls}
				<p class="time">{ms(r.tls.ms)}</p>
				<p>{r.tls.detail}</p>
				{#if r.tls.protocol}
					<p class="meta">{r.tls.protocol} · {r.tls.cipher}</p>
				{/if}
			{:else}
				<p>Hoppet over, ingen IP å koble til.</p>
			{/if}
		</div>

		<div class="step" class:ok={r.http?.ok} class:fail={r.http && !r.http.ok} class:skipped={!r.http}>
			<h2>3. HTTPS-forespørsel</h2>
			{#if r.http}
				<p class="time">{ms(r.http.ms)}</p>
				<p>{r.http.detail}</p>
				{#if r.http.server}
					<p class="meta">Server: {r.http.server}</p>
				{/if}
			{:else}
				<p>Hoppet over, ingen IP å koble til.</p>
			{/if}
		</div>
	</section>

	{#if r.tls?.cert}
		{@const cert = r.tls.cert}
		<section class="cert">
			<h2>Sertifikat</h2>
			<dl>
				<dt>Subject</dt>
				<dd><code>{cert.subject}</code></dd>
				<dt>Navn</dt>
				<dd>{#each cert.altNames as name}<code>{name}</code> {/each}</dd>
				<dt>Utsteder</dt>
				<dd>{cert.issuer}</dd>
				<dt>Gyldig</dt>
				<dd>{date(cert.validFrom)} – {date(cert.validTo)} <strong class:warn={cert.daysLeft < 21}>({cert.daysLeft} dager igjen)</strong></dd>
				<dt>Kjede</dt>
				<dd class="chain">
					{#each cert.chain as link, i}
						{#if i > 0}<span class="arrow">→</span>{/if}<code>{link}</code>
					{/each}
				</dd>
			</dl>
		</section>
	{/if}

	<form method="GET">
		<label for="ip">Test mot IP (privat IPv4, valgfritt)</label>
		<input id="ip" name="ip" placeholder="10.x.x.x" value={r.ipSource === "query" ? r.targetIp : ""} />
		<button type="submit">Kjør på nytt</button>
	</form>
</div>

<style>
	.edge-poc {
		max-width: 60rem;
		margin: 2rem auto;
		padding: 0 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	header {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 1rem 1.25rem;
		border-radius: 0.5rem;
		border-left: 0.5rem solid;
	}
	header h1 {
		margin: 0;
		font-size: 1.4rem;
	}
	header p {
		margin: 0.25rem 0 0;
	}
	.badge {
		font-weight: 700;
		font-size: 1.1rem;
		padding: 0.4rem 0.8rem;
		border-radius: 0.3rem;
		color: white;
	}
	.ok {
		border-color: var(--color-primary);
		background: var(--color-secondary-10);
	}
	.ok .badge {
		background: var(--color-primary);
	}
	.fail {
		border-color: var(--color-danger);
		background: #fbeef1;
	}
	.fail .badge {
		background: var(--color-danger);
	}
	.steps {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 1rem;
	}
	.step {
		padding: 1rem;
		border-radius: 0.5rem;
		border-top: 0.3rem solid;
	}
	.step.skipped {
		border-color: var(--color-primary-30);
		background: var(--color-primary-10);
	}
	.step h2 {
		margin: 0 0 0.25rem;
		font-size: 1rem;
	}
	.step p {
		margin: 0.25rem 0;
		word-break: break-word;
	}
	.time {
		font-size: 1.6rem;
		font-weight: 700;
	}
	.meta,
	.hint {
		font-size: 0.85rem;
		opacity: 0.8;
	}
	.cert {
		padding: 1rem 1.25rem;
		border-radius: 0.5rem;
		background: var(--color-primary-10);
	}
	.cert h2 {
		margin-top: 0;
		font-size: 1.1rem;
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.4rem 1rem;
		margin: 0;
	}
	dt {
		font-weight: 600;
	}
	dd {
		margin: 0;
	}
	.chain {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.warn {
		color: var(--color-danger);
	}
	form {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	input {
		padding: 0.4rem 0.6rem;
	}
</style>
