<script lang="ts">
	import { onMount } from "svelte"
	import { fade, slide } from "svelte/transition"
	import favicon16 from "$lib/assets/favicon-16x16.png"
	import type { AuthenticatedPrincipal } from "$lib/types/authentication"
	import type { ChatConfig } from "$lib/types/chat"

	type Props = {
		authenticatedUser: AuthenticatedPrincipal
		menuOpen?: boolean
		onMenuToggle?: (isOpen: boolean) => void
	}
	let { authenticatedUser, menuOpen = $bindable(true), onMenuToggle }: Props = $props()

	const smallScreenWidth = 1120
	let screenIsLarge = $state(true)

	const getAgents = async (): Promise<ChatConfig[]> => {
		const agentResponse = await fetch("/api/chatconfigs")
		if (!agentResponse.ok) {
			throw new Error("Failed to fetch agents")
		}
		const agentsData = (await agentResponse.json()) as ChatConfig[]
		return agentsData
	}

	onMount(() => {
		screenIsLarge = window.innerWidth > smallScreenWidth
		if (!screenIsLarge) {
			menuOpen = false
			onMenuToggle?.(false)
		}
		const handleResize = () => {
			const wasLarge = screenIsLarge
			screenIsLarge = window.innerWidth > smallScreenWidth
			if (screenIsLarge && !wasLarge) {
				menuOpen = true
				onMenuToggle?.(true)
			}
			if (!screenIsLarge && wasLarge) {
				menuOpen = false
				onMenuToggle?.(false)
			}
		}
		window.addEventListener("resize", handleResize)
		return () => window.removeEventListener("resize", handleResize)
	})

	const toggleMenu = () => {
		menuOpen = !menuOpen
		onMenuToggle?.(menuOpen)
	}

	const closeMenuOnSmallScreen = () => {
		if (!screenIsLarge) {
			menuOpen = false
			onMenuToggle?.(false)
		}
	}

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === "Escape" && menuOpen && !screenIsLarge) {
			menuOpen = false
			onMenuToggle?.(false)
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Backdrop overlay for small screens -->
{#if menuOpen && !screenIsLarge}
	<button
		class="menu-backdrop"
		transition:fade={{ duration: 150 }}
		onclick={closeMenuOnSmallScreen}
		aria-label="Lukk meny"
	></button>
{/if}

{#if !menuOpen}
	<div class="open-menu-container" transition:fade={{ duration: 100, delay: 100 }}>
		<button class="icon-button" onclick={toggleMenu} title="Åpne meny" aria-expanded="false" aria-controls="sidebar-menu">
			<span class="material-symbols-rounded">left_panel_open</span>
		</button>
	</div>
{:else}
	<nav class="menu" id="sidebar-menu" aria-label="Hovedmeny" transition:slide={{ axis: 'x', duration: 150 }}>
		<div class="menu-header">
			<div class="app-title"><img src={favicon16} alt="Mugin logo" /> Mugin</div>
			<button class="icon-button" onclick={toggleMenu} title="Lukk meny" aria-expanded="true" aria-controls="sidebar-menu">
				<span class="material-symbols-rounded">left_panel_close</span>
			</button>
		</div>
		<div class="menu-content">
			<div class="menu-section">
				<div class="menu-items">
					<a class="menu-item" href="/" onclick={closeMenuOnSmallScreen}>
						<span class="material-symbols-outlined">home</span>Hjem
					</a>
				</div>
			</div>
			<div class="menu-section">
				{#await getAgents()}
					<div class="menu-section">
						<div class="menu-section-title">Agenter</div>
						<span class="loading-text">Laster...</span>
					</div>
					<div class="menu-section">
						<div class="menu-section-title">Dine agenter</div>
						<span class="loading-text">Laster...</span>
					</div>
				{:then agents}
					<div class="menu-section">
						<div class="menu-section-title">Agenter</div>
						<div class="menu-items">
							{#each agents.filter(agent => agent.type !== "private") as agent}
								<a class="menu-item" href={"/agents/" + agent._id} onclick={closeMenuOnSmallScreen}>
									{agent.name}
								</a>
							{/each}
							<a class="menu-item" href="/agents" onclick={closeMenuOnSmallScreen}>
								<span class="material-symbols-outlined">more_horiz</span>Se alle agenter
							</a>
						</div>
					</div>
					<div class="menu-section">
						<div class="menu-section-title">Dine agenter</div>
						<div class="menu-items">
							{#each agents.filter(agent => agent.type === "private") as agent}
								<a class="menu-item" href={"/agents/" + agent._id} onclick={closeMenuOnSmallScreen}>
									{agent.name}
								</a>
							{/each}
							<a class="menu-item" href="/?createAgent=true" onclick={closeMenuOnSmallScreen}>
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
		</div>
	</nav>
{/if}
<style>
	/* Backdrop overlay for small screens */
	.menu-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.4);
		z-index: 99;
		border: none;
		cursor: pointer;
	}

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
		width: 14rem;
		height: 100%;
		background-color: var(--color-secondary-10);
		display: flex;
		flex-direction: column;
		padding: 0rem 1rem;
		box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
	}
	.menu-content {
		flex: 1;
		overflow-y: auto;
	}
	.menu-section {
		margin: 1.5rem 0rem;
	}
	.menu-section-title, .menu-item {
		padding: 0.25rem 0.5rem;
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
	}
	.menu-section-title {
		font-weight: bold;
		text-transform: uppercase;
		font-size: 0.75rem;
		align-items: center;
		color: var(--color-primary-60, #666);
	}
	.menu-item {
		font-size: 0.9rem;
		text-decoration: none;
		margin-bottom: 0.2rem;
		border-radius: 0.5rem;
		transition: background-color 0.15s ease;
	}
	.menu-item:hover, .menu-item.active {
		background-color: var(--color-secondary-30);
	}
	.menu-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 0rem;
		border-top: 1px solid var(--color-secondary-30);
	}
	.logged-in-user {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}
	.loading-text {
		padding: 0.25rem 0.5rem;
		font-size: 0.85rem;
		color: var(--color-primary-60, #666);
	}

	/* Large screen: sidebar is part of the layout flow */
	@media (min-width: 70rem) {
		.menu {
			position: relative;
			box-shadow: none;
			border-right: 1px solid var(--color-secondary-30);
		}
		.menu-backdrop {
			display: none;
		}
	}
</style>