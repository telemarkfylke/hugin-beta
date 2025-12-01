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
		<li><a class="menu_links" href="/">Home</a></li>
		<li><a class="menu_links" href="/agents">Agents</a></li>
	</menu>
</header>

<main>
	{#if children}
		{@render children()}
	{:else}
		<p>fallback content</p>
	{/if}
</main>



<style>
	* {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
		font-family: Arial, Helvetica, sans-serif;
	}

	
	
	header {
		display: flex;
		align-items: center;
		position: relative;
		justify-content: center;
		color: #333;
		height: 45px;

		
	}
	
	h1 {
		margin: 0;
	}
	
	
	.menu_links {
		color: #333;
	}
	menu {
		display: flex;
		gap: 1rem;
		list-style-type: none;
		align-items: center;
		position: absolute;
		right: 1rem;

	}
	main {
		box-sizing: border-box;
		min-height: calc(100vh - 45px); /* Trekk fra header høyde */
		max-height: calc(100vh - 45px);
		width: 1200px;
		margin-left: auto;
		margin-right: auto;
		display: block;
		overflow: hidden;
	}
</style>