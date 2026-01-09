<script lang="ts">
	import favicon16 from "$lib/assets/favicon-16x16.png"
	import favicon32 from "$lib/assets/favicon-32x32.png"
	import "../style.css" // Add global css (and make it hot reload)
	import "../lib/axe.js"
	import type { LayoutProps } from "./$types.js"

	// Get layout props, data will be accessible for children as well, so do not put too much here to avoid overfetching
	let { children, data }: LayoutProps = $props()
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="32x32" href={favicon32}>
	<link rel="icon" type="image/png" sizes="16x16" href={favicon16}>
	<style>
		@import url('https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,700&display=swap');
		@import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,700&display=swap');
		@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
	</style>
</svelte:head>

<header>
	<h1>Hugin Beta</h1>
	<menu>
		{data.authenticatedUser.name}
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