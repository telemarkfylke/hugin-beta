<script lang="ts">
  import { onMount } from "svelte";
	import favicon16 from "$lib/assets/favicon-16x16.png"
  import type { AuthenticatedPrincipal } from "$lib/types/authentication";
  import { slide, fade } from "svelte/transition";


	type Props = {
		authenticatedUser: AuthenticatedPrincipal
	}
	let { authenticatedUser }: Props = $props()

	let menuOpen = $state(true)

	const smallScreenWidth = 1120
	let screenIsLarge = true

	onMount(() => {
		if (window.innerWidth <= smallScreenWidth) {
			menuOpen = false;
			screenIsLarge = false;
		}
		const handleResize = () => {
			if (window.innerWidth >= smallScreenWidth && !screenIsLarge) {
				screenIsLarge = true;
				menuOpen = true;
			}
			if (window.innerWidth < smallScreenWidth && screenIsLarge) {
				screenIsLarge = false;
				menuOpen = false;
			}
		};
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
  });

	const toggleMenu = () => {
		menuOpen = !menuOpen
	}

</script>

{#if !menuOpen}
	<div class="open-menu-container" transition:fade={{ duration: 100, delay: 100 }}>
		<button class="icon-button" onclick={toggleMenu} title="Åpne meny">
			<span class="material-symbols-rounded">left_panel_open</span>
		</button>
	</div>
{:else}
	<div class="menu" transition:slide={{ axis: 'x', duration: 100 }}>
		<div class="menu-header">
			<div class="app-title"><img src={favicon16} alt="Mugin logo" /> Mugin</div>
			<button class="icon-button" onclick={toggleMenu} title="Lukk meny">
				<span class="material-symbols-rounded">left_panel_close</span>
			</button>
		</div>
		<div class="menu-content">
			<a href="/">Hjem</a>
		</div>
		<div class="menu-footer">
			<div class="logged-in-user">
				<span class="material-symbols-outlined">account_circle</span>
				{authenticatedUser.name}
			</div>
			<!--
			<button class="icon-button" title="Logg ut" onclick={() => { console.log("Logging out...") }}>
				<span class="material-symbols-rounded">logout</span>
			</button>
			-->
		</div>
	</div>
{/if}
<style>
	.open-menu-container, .menu-header {
		height: var(--header-height);
		display: flex;
		align-items: center;
	}
	.open-menu-container {
		position: fixed;
		z-index: 100;
	}
	.menu-header {
		justify-content: space-between;
	}
	.app-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: bold;
	}
	.menu {
		position: fixed;
		z-index: 100;
		width: 16rem;
		height: 100%;
		background-color: var(--color-gress-10);
		display: flex;
		flex-direction: column;
		padding: 0rem 1rem;
	}
	.menu-content {
		flex: 1;
	}
	.menu-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 0rem;
	}
	.logged-in-user {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* If large screen */
	@media (min-width: 70rem) {
		.menu {
			position: static;
		}
	}


/*
hvis den er liten

*/

</style>