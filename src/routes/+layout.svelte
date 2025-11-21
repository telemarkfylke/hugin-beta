<script>
	import favicon from "$lib/assets/favicon.svg"
	import "../style.css" // Add global css (and make it hot reload)
	import "../lib/axe.js"

	let { children } = $props()
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<h1>Hugin Beta</h1>
	<menu>
		<li><a href="/">Home</a></li>
		<li><a href="/agents">Agents</a></li>
	</menu>
</header>
<main>
	{#if children}
		{@render children()}
	{:else}
		<p>fallback content</p>
	{/if}
</main>
<footer>
	<span>Footer</span>
</footer>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 40px;
		box-sizing: border-box;
	}
	main {
		box-sizing: border-box;
		height: calc(100% - 80px); /* Adjust based on header and footer height */
	}
	footer {
		box-sizing: border-box;
		height: 40px;
	}
</style>