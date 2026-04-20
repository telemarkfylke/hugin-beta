<script lang="ts">
	import { onMount } from "svelte"
	import { fade, slide } from "svelte/transition"
	import { onNavigate } from "$app/navigation"
	import { page } from "$app/state"
	import favicon16 from "$lib/assets/favicon-16x16.png"
	import type { FeatureMap } from "$lib/features/featuremap"
	import { checkFeatureMap, getFeatures } from "$lib/features/service"
	import type { AuthenticatedPrincipal } from "$lib/types/authentication"
	import type { ChatConfig } from "$lib/types/chat"

	type Props = {
		authenticatedUser: AuthenticatedPrincipal
		appName: string
		isEmployee: boolean
	}
	let { authenticatedUser, appName, isEmployee }: Props = $props()

	let menuOpen = $state(true)
	let menuAgents: {
		isLoading: boolean
		agents: ChatConfig[]
		error: string | null
	} = $state({ isLoading: false, agents: [], error: null })

	const smallScreenWidth = 1120
	let screenIsLarge = true

	let featuremap: FeatureMap = $state({})

	$effect(() => {
		page.url // Track page url changes
		if (!screenIsLarge) {
			menuOpen = false
		}
	})

	const getAgents = async (): Promise<ChatConfig[]> => {
		const agentResponse = await fetch("/api/chatconfigs")
		if (!agentResponse.ok) {
			throw new Error("Failed to fetch agents")
		}
		const agentsData = (await agentResponse.json()) as ChatConfig[]
		return agentsData
	}

	const loadFeatures = async () => {
		featuremap = await getFeatures()
	}

	const loadAgents = async () => {
		menuAgents.isLoading = true
		menuAgents.error = null
		try {
			menuAgents.agents = await getAgents()
		} catch (error) {
			console.error("Error loading agents:", error)
			menuAgents.error = (error as Error).message
		}
		menuAgents.isLoading = false
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

		loadAgents()
		loadFeatures()

		return () => window.removeEventListener("resize", handleResize)
	})

	onNavigate(({ from, to, type }) => {
		// Programmatic navigation (goto) (please use href for user navigation...)
		if (type === "goto") {
			const cameFromCreate = from?.route.id === "/agents/create"
			const cameFromDelete = from?.route.id?.startsWith("/agents/") && to?.route.id === "/agents"
			const cameFromUpdate = from?.route.id && from.route.id === to?.route.id
			if (cameFromCreate || cameFromDelete || cameFromUpdate) {
				loadAgents()
			}
		}
	})

	const toggleMenu = () => {
		menuOpen = !menuOpen
	}

	const STORAGE_KEY = "hugin_skip_new_chat_confirm"

	let showUserSettings = $state(false)
	let settingSkipNewChatConfirm = $state(false)

	const openUserSettings = () => {
		settingSkipNewChatConfirm = localStorage.getItem(STORAGE_KEY) === "true"
		showUserSettings = true
	}

	const saveUserSettings = () => {
		localStorage.setItem(STORAGE_KEY, settingSkipNewChatConfirm ? "true" : "false")
		showUserSettings = false
	}
</script>

{#if !menuOpen}
	<div
		class="open-menu-container"
		transition:fade={{ duration: 100, delay: 100 }}
	>
		<button class="icon-button" onclick={toggleMenu} title="Åpne meny">
			<span class="material-symbols-rounded">left_panel_open</span>
		</button>
	</div>
{:else}
	<div
		class="app-overlay"
		transition:fade={{ duration: 100 }}
		onclick={() => {
			menuOpen = false;
		}}
	></div>
	<div
		class="menu large-screen-space-stealer"
		transition:slide={{ axis: "x", duration: 100 }}
	></div>
	<div class="menu" transition:slide={{ axis: "x", duration: 100 }}>
		<div class="menu-header">
			<div class="app-title">
				<img src={favicon16} alt="{appName} logo" />
				{appName}
			</div>
			<button class="icon-button" onclick={toggleMenu} title="Lukk meny">
				<span class="material-symbols-rounded">left_panel_close</span>
			</button>
		</div>
		<div class="menu-content">
			<div class="menu-section">
				<div class="menu-items">
					<a
						class="menu-item"
						class:active={page.url.pathname === "/"}
						href="/"
					>
						<span class="material-symbols-outlined">home</span>Hjem
					</a>
				</div>
			</div>
			<div class="menu-section">
				{#if menuAgents.isLoading}
					<div class="menu-section">
						<div class="menu-section-title">Agenter</div>
						loading...
					</div>
					<div class="menu-section">
						<div class="menu-section-title">Dine agenter</div>
						loading...
					</div>
				{:else if menuAgents.error}
					<div class="menu-section">
						<div class="menu-section-title">Agenter</div>
						loading...
					</div>
					<div class="menu-section">
						<div class="menu-section-title">Dine agenter</div>
						loading...
					</div>
				{:else}
					<div class="menu-section">
						<div class="menu-section-title">Agenter</div>
						<div class="menu-items">
							{#each menuAgents.agents
								.filter((agent) => agent.type === "published")
								.slice(0, 5) as agent}
								<a
									class="menu-item"
									class:active={page.url.pathname === "/agents/" + agent._id}
									href={"/agents/" + agent._id}
								>
									{agent.name}
								</a>
							{/each}
							<a
								class="menu-item"
								class:active={page.url.pathname === "/agents"}
								href="/agents"
							>
								<span class="material-symbols-outlined">more_horiz</span>Se alle
								agenter
							</a>
						</div>
					</div>
					<div class="menu-section">
						<div class="menu-section-title">Dine agenter</div>
						<div class="menu-items">
							{#each menuAgents.agents
								.filter((agent) => agent.type === "private" && agent.created.by.id === authenticatedUser.userId)
								.slice(0, 5) as agent}
								<a
									class="menu-item"
									class:active={page.url.pathname === "/agents/" + agent._id}
									href={"/agents/" + agent._id}
								>
									{agent.name}
								</a>
							{/each}
							<a
								class="menu-item"
								class:active={page.url.pathname === "/agents/create"}
								href="/agents/create"
							>
								<span class="material-symbols-outlined">add</span>Lag ny agent
							</a>
						</div>
					</div>
				{/if}
			</div>
			{#if checkFeatureMap("TRANSCRIPTION", featuremap) && isEmployee}
				<div class="menu-section">
					<div class="menu-section-title">Andre tjenester</div>
					<div class="menu-items">
						<a
							class="menu-item"
							class:active={page.url.pathname === "/transcription"}
							href="/transcription">Tale-til-notat</a
						>
					</div>
				</div>
			{/if}
		</div>
		<div class="menu-footer">
			<button
				class="icon-button logged-in-user"
				onclick={openUserSettings}
				title="Brukerinnstillinger"
			>
				<span class="material-symbols-outlined">account_circle</span>
				{authenticatedUser.name}
			</button>
		</div>
	</div>
{/if}

{#if showUserSettings}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="settings-backdrop" onclick={() => (showUserSettings = false)}>
		<div class="settings-modal" onclick={(e) => e.stopPropagation()}>
			<div class="settings-hero">
				<p class="settings-tagline">Ikke mye her ennå…</p>
			</div>
			<div class="settings-options">
				<label class="settings-toggle">
					<input type="checkbox" bind:checked={settingSkipNewChatConfirm} />
					<span>Ikke vis advarsel ved ny samtale</span>
				</label>
			</div>
			<div class="settings-actions">
				<button onclick={() => (showUserSettings = false)}>Avbryt</button>
				<button class="filled" onclick={saveUserSettings}>Lagre</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.app-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.3);
		z-index: 50;
	}
	.open-menu-container,
	.menu-header {
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
		height: 100vh;
		background-color: var(--color-secondary-10);
		display: flex;
		flex-direction: column;
		padding: 0rem 1rem;
		overflow: auto;
	}
	.menu-content {
		flex: 1;
	}
	.menu-section {
		margin: 2rem 0rem;
	}
	.menu-section-title,
	.menu-item {
		padding: 0.25rem 0.5rem;
		display: flex;
		align-items: center;
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
		border-radius: 0.5rem;
	}
	.menu-item:hover,
	.menu-item.active {
		background-color: var(--color-secondary-30);
	}
	.menu-item.active {
		font-weight: bold;
	}
	.menu-item.active:hover {
		color: var(--color-primary);
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
		font-size: 0.9rem;
		border: none;
		color: inherit;
		opacity: 0.75;
		padding: 0.25rem 0.5rem;
		border-radius: 0.5rem;
		width: 100%;
	}
	.logged-in-user:hover {
		opacity: 1;
		background-color: var(--color-secondary-30);
	}

	.settings-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}
	.settings-modal {
		background: white;
		border-radius: 12px;
		padding: 2rem 1.75rem 1.5rem;
		max-width: 22rem;
		width: 90%;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
	}
	.settings-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}
	.settings-tagline {
		margin: 0;
		color: #999;
		font-size: 0.9rem;
		font-style: italic;
	}
	.settings-options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.settings-toggle {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.9rem;
		cursor: pointer;
		color: inherit;
		padding-bottom: 0;
	}
	.settings-toggle input {
		width: auto;
	}
	.settings-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	/* If large screen */
	@media (min-width: 70rem) {
		.app-overlay {
			display: none;
		}
		.menu.large-screen-space-stealer {
			position: static;
		}
	}
	/* If very small screen */
	@media (max-width: 30rem) {
		.app-overlay {
			display: none;
		}
		.menu {
			width: calc(100% - 1rem);
		}
	}
</style>
