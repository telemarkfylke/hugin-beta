<script lang="ts">
  import { onMount } from "svelte";
	import favicon16 from "$lib/assets/favicon-16x16.png"

	let menuOpen = $state(true)

	let screenIsLarge = true

	const smallScreenWidth = 1120

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
	<div class="open-menu-container">
		<button class="icon-button" onclick={toggleMenu} title="Åpne meny">
			<span class="material-symbols-rounded">left_panel_open</span>
		</button>
	</div>
{:else}
	<div class="menu">
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
			Innlogga bruker eller no drit
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
		background-color: #f0f0f0;
		animation: slideInFromLeft 0.1s ease-out forwards;
		display: flex;
		flex-direction: column;
		padding: 0rem 1rem;
	}
	.menu-content {
		flex: 1;
	}
	.menu-footer {
		padding: 1rem 0rem;
	}

	@keyframes slideInFromLeft {
		/* Start off-screen to the left */
		from {
			transform: translateX(-100vw);
		}
		/* End at its original position */
		to {
			transform: translateX(0);
		}
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