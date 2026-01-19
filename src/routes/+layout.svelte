<script lang="ts">
	import favicon from "$lib/assets/favicon.svg"
	import "../style.css" // Add global css (and make it hot reload)
	import "../lib/axe.js"
	import type { LayoutProps } from "./$types.js"

	let isMenuOpen = $state(true);
	// Get layout props, data will be accessible for children as well, so do not put too much here to avoid overfetching
	let { children, data }: LayoutProps = $props()

	function toggleSidebar() {
    isMenuOpen = !isMenuOpen;
	}
	// I +layout.svelte script
$effect(() => {
  if (typeof document !== 'undefined') {
	document.body.classList.toggle('sidebar-open', isMenuOpen);
  }
});
</script>
<button class="sidebar-toggle" onclick={toggleSidebar}>☰</button>
<button class="new_chat_btn"><img class="New_chat" src="/ikoner/tool_13645639-removebg-preview.png" alt=""></button>
<div class="Sidebar" class:open={isMenuOpen}>
	<p class="sidebar_info">
		Samtalehistorikk
	</p>
	</div>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<!-- <h1>Hugin Beta</h1>-->
	<menu>
		{data.authenticatedUser.name}
	</menu>
</header>
<main>
	<div class="content" class:sidebar-open={isMenuOpen}>
		{#if children}
			{@render children()}
		{:else}
			<p>fallback content</p>
		{/if}
	</div>
</main>
<footer>
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
	.sidebar-toggle {
		height: 40px;
		width: 40px;
		border-radius: 4px;
		font-size: 15px;
		border-style: none;
		background-color: #80A8AF;
		box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2);
		margin-top: 5px;
        position: fixed;
        left: 5px;
        z-index: 2000; /* Høyere enn sidebar */
		transition: background-color 0.3s ease;
}
	.sidebar-toggle:hover {
		background-color: #196370;
	}
	.sidebar_info {
		margin-top: 60px;
		font-size: 18px;
		font-weight: bold;
		text-align: center;
		margin-bottom: 1rem;
	}
	main {
		box-sizing: border-box;
		height: calc(100% - var(--header-height) - var(--footer-height)); /* Adjust based on header and footer height */
		
	}
	
	.content {
		margin-left: 0;
		margin-right: 0;
		transition: margin-left 0.3s ease, margin-right 0.3s ease;
	}
	
	.content.sidebar-open {
		margin-left: 260px;
		margin-right: 40px;
	}

	.New_chat {
		width: 20px;
		height: 20px;
	}
	.new_chat_btn {
		position: fixed;
		width: 40px;
		height: 40px;
        left: 60px;
		background-color: #80A8AF;
		box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2);
		border-radius: 4px;
		border-style: none;
        top: 5px;
        z-index: 2000; /* Høyere enn sidebar */
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.3s ease;
	}
	.new_chat_btn:hover {
		background-color: #196370;
	}
	.Sidebar {
		position: fixed;
        top: 0;
        left: 0;
        width: 220px;
        height: 100vh;
        background: #77A7A7;
		box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
		border-style: solid 1px #333;
        color: #fff;
        padding: 2rem 1rem 1rem 1rem;
        transform: translateX(-100%);
        transition: transform 0.3s cubic-bezier(.77,.2,.05,1.0);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 1rem;
	}
	.Sidebar.open {
		transform: translateX(0);
	}
	footer {
		box-sizing: border-box;
		height: var(--footer-height);

	}
</style>