<script lang="ts">
	import { onMount } from "svelte"
	import { fade, slide } from "svelte/transition"
	import favicon16 from "$lib/assets/favicon-16x16.png"
	import type { AuthenticatedPrincipal } from "$lib/types/authentication"
  import type { ChatConfig } from "$lib/types/chat";

	type Props = {
		authenticatedUser: AuthenticatedPrincipal
	}
	let { authenticatedUser }: Props = $props()

	let menuOpen = $state(true)

	const smallScreenWidth = 1120
	let screenIsLarge = true



	const getAgents = async (): Promise<ChatConfig[]> => {
		const agentResponse = await fetch('/api/chatconfigs');
		if (!agentResponse.ok) {
			throw new Error('Failed to fetch agents');
		}
		const agentsData = (await agentResponse.json()) as ChatConfig[];
		return agentsData;
	}

	onMount(() => {
		if (window.innerWidth <= smallScreenWidth) {
			menuOpen = false
			screenIsLarge = false
		}
		const handleResize = () => {
			if (window.innerWidth >= smallScreenWidth && !screenIsLarge) {
				screenIsLarge = true
				menuOpen = true
			}
			if (window.innerWidth < smallScreenWidth && screenIsLarge) {
				screenIsLarge = false
				menuOpen = false
			}
		}
		window.addEventListener("resize", handleResize)
		return () => window.removeEventListener("resize", handleResize)
	})

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
			<div class="menu-section">
				<div class="menu-items">
					<a class="menu-item" href="/">
						<span class="material-symbols-outlined">home</span>Hjem
					</a>
				</div>
			</div>
			<div class="menu-section">
				{#await getAgents()}
					<div class="menu-section">
						<div class="menu-section-title">Agenter</div>
						loading...
					</div>
					<div class="menu-section">
						<div class="menu-section-title">Dine agenter</div>
						loading...
					</div>
				{:then agents} 
					<div class="menu-section">
						<div class="menu-section-title">Agenter</div>
						<div class="menu-items">
							{#each agents.filter(agent => agent.type !== "private") as agent}
								<a class="menu-item" href={"/agents/" + agent._id}>
									{agent.name}
								</a>
							{/each}
							<a class="menu-item" href="/agents">
								<span class="material-symbols-outlined">more_horiz</span>Se alle agenter
							</a>
						</div>
					</div>
					<div class="menu-section">
						<div class="menu-section-title">Dine agenter</div>
						<div class="menu-items">
							{#each agents.filter(agent => agent.type === "private") as agent}
								<a class="menu-item" href={"/agents/" + agent._id}>
									{agent.name}
								</a>
							{/each}
							<a class="menu-item" href="/?createAgent=true">
								<span class="material-symbols-outlined">add</span>Lag ny agent
							</a>
						</div>	
					</div>
				{/await}
			</div>
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
		width: 12rem;
		height: 100%;
		background-color: var(--color-secondary-10);
		display: flex;
		flex-direction: column;
		padding: 0rem 1rem;
	}
	.menu-content {
		flex: 1;
	}
	.menu-section {
		margin: 2rem 0rem;
	}
	.menu-section-title, .menu-item {
		padding: 0.25rem 0.5rem;
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
	}
	.menu-section-title {
		font-weight: bold;
		text-transform: uppercase;
		font-size: 0.75rem;
		align-items: center;
	}
	.menu-item {
		font-size: 0.9rem;
		text-decoration: none;
		margin-bottom: 0.2rem;
	}
	.menu-item:hover, .menu-item.active {
		background-color: var(--color-secondary-30);
		border-radius: 0.5rem;
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