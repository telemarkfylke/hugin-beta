<script lang="ts">
	import favicon from "$lib/assets/favicon.svg"
	import "../style.css" // Add global css (and make it hot reload)
	import "../lib/axe.js"
	import type { LayoutProps } from "./$types.js"

	// Get layout props, data will be accessible for children as well, so do not put too much here to avoid overfetching
	let { children }: LayoutProps = $props()
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<h1>Hugin Beta<img src="https://arngren.net/JUL-2009-5.gif" alt="funny gif" /></h1>
	<img src="https://arngren.net/JUL-2009-4.gif" alt="funny gif" />
	<menu>
		<li><a href="/">Home</a></li>
		<li><a href="/agents">Agents</a></li>
		<img src="https://arngren.net/JUL-2009-4.gif" alt="funny gif" />
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
	<img src="https://arngren.net/JUL-2009-4.gif" alt="funny gif" />
	<img src="https://arngren.net/JUL-2009-5.gif" alt="funny gif" />
	<img src="https://arngren.net/JUL-2009-6.gif" alt="funny gif" />
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