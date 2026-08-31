<script lang="ts">
	import { page } from "$app/stores"

	// True for both /embed/** (authenticated) and /public/embed/** (anonymous) - mirrors
	// +layout.server.ts's isEmbedRoute. An embed is rendered inside someone else's page/iframe, so
	// a "go to homepage"/"log in" link back into the main app isn't just clutter, it's broken: it
	// would navigate the embedding page's iframe to a login screen the visitor never asked for.
	const isEmbedRoute = $derived(Boolean($page.route.id?.includes("/embed/")))
</script>

<div class="error-container">
	{#if $page.status === 401}
		<h1>Sesjonen din har utløpt</h1>
		<p>Du må logge inn på nytt for å fortsette.</p>
		{#if !isEmbedRoute}
			<a href="/">Logg inn</a>
		{/if}
	{:else if $page.status === 403}
		<h1>Ingen tilgang</h1>
		<p>Du har ikke tilgang til denne siden.</p>
		{#if !isEmbedRoute}
			<a href="/">Gå til forsiden</a>
			<a href="/.auth/login/aad?post_login_redirect_uri=/" class="secondary">Logg inn på nytt</a>
		{/if}
	{:else}
		<h1>Noe gikk galt</h1>
		<p>{$page.error?.message ?? "En ukjent feil oppstod."}</p>
		{#if !isEmbedRoute}
			<a href="/">Gå til forsiden</a>
		{/if}
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

	a.secondary {
		background-color: transparent;
		color: var(--color-primary, #0066cc);
		border: 1px solid var(--color-primary, #0066cc);
	}
</style>
