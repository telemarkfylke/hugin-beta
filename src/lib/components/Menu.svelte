<script lang="ts">
  import { onMount } from "svelte";

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
	<h3 class="open-menu">
		<button onclick={toggleMenu} title="Åpne meny">
			<span class="material-symbols-rounded">menu</span>
		</button>
	</h3>
{:else}
	<div class="menu">
		<div class="menu-header">
			<h3 class="close-menu-container">
				<button onclick={toggleMenu} title="Lukk meny">
					<span class="material-symbols-rounded">arrow_menu_close</span>
					Lukk meny
				</button>
			</h3>
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
	.open-menu {
		position: fixed;
		z-index: 100;
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