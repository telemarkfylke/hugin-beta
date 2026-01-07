<script lang="ts">
	import favicon from "$lib/assets/favicon.svg"
	import "../style.css" // Add global css (and make it hot reload)
	import "../lib/axe.js"
	import type { LayoutProps } from "./$types.js"

	// Get layout props, data will be accessible for children as well, so do not put too much here to avoid overfetching
	let { children, data }: LayoutProps = $props()
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<h1>Hugin Beta</h1>
	<menu>
		{data.authenticatedUser.name}
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
	:root {
		--header-height: 60px;
		--footer-height: 40px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: var(--header-height);
		box-sizing: border-box;
	}
	main {
		box-sizing: border-box;
		height: calc(100% - var(--header-height) - var(--footer-height)); /* Adjust based on header and footer height */
	}
	footer {
		box-sizing: border-box;
		height: var(--footer-height);
	}
</style>