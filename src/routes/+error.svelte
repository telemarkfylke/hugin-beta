<script lang="ts">
	import { page } from "$app/stores"
</script>

<div class="error-container">
	{#if $page.status === 401}
		<h1>Sesjonen din har utløpt</h1>
		<p>Du må logge inn på nytt for å fortsette.</p>
		<a href="/">Logg inn</a>
	{:else if $page.status === 403}
		<h1>Ingen tilgang</h1>
		<p>Du har ikke tilgang til denne siden.</p>
		<a href="/">Gå til forsiden</a>
	{:else}
		<h1>Noe gikk galt</h1>
		<p>{$page.error?.message ?? "En ukjent feil oppstod."}</p>
		<a href="/">Gå til forsiden</a>
	{/if}
</div>

<style>
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 1rem;
		text-align: center;
		padding: 2rem;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
	}

	a {
		margin-top: 0.5rem;
		padding: 0.5rem 1.5rem;
		background-color: var(--color-primary, #0066cc);
		color: white;
		border-radius: 4px;
		text-decoration: none;
	}

	a:hover {
		opacity: 0.85;
	}
</style>
