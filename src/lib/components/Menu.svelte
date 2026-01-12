<script lang="ts">
	let menuElement: HTMLDivElement

	const toggleMenu = () => {
		menuElement.classList.toggle("mobile-closed")
	}

</script>
<h3 class="open-menu">
	<button onclick={toggleMenu} title="Åpne meny">
		<span class="material-symbols-rounded">menu</span>
	</button>
</h3>
<div class="menu mobile-closed" bind:this={menuElement}>
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
	/* If small screen */
	@media (max-width: 70rem) {
		.menu.mobile-closed {
			display: none;
		}
	}

	/* If large screen */
	@media (min-width: 70rem) {
		.close-menu-container {
			display: none;
		}
		.open-menu {
			display: none;
		}
		.menu {
			position: static;
			animation: none;
		}
	}


/*
hvis den er liten

*/

</style>