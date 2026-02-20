<script lang="ts">
	import { slide } from "svelte/transition"
	import { page } from "$app/state"
	import { canEditChatConfig, canEditPredefinedConfig, canPublishChatConfig } from "$lib/authorization"
	import type { ChatConfig, VendorId } from "$lib/types/chat"
	import GrowingTextArea from "../GrowingTextArea.svelte"
	import type { ChatState } from "./ChatState.svelte"
	import ConversationExport from "./ConversationExport.svelte"

	type Props = {
		chatState: ChatState
	}

	let { chatState = $bindable() }: Props = $props()

	let showDescription: boolean = $state(false)

	let userCanEditConfig = $derived(canEditChatConfig(chatState.chat, chatState.user, chatState.APP_CONFIG.APP_ROLES))
	let userCanEditPredefinedConfig = $derived(canEditPredefinedConfig(chatState.user, chatState.APP_CONFIG.APP_ROLES))

	$effect(() => {
		chatState.configEdited = JSON.stringify(chatState.chat.config) !== JSON.stringify(chatState.initialConfig)
	})

	// let debug: boolean = $state(false)

	// Not reactive state, to "remember" predefined vs manual config when toggling
	let predefinedConfigCache: Partial<ChatConfig> = {
		vendorId: "MISTRAL",
		vendorAgent: {
			id: ""
		}
	}
	let manualConfigCache: Partial<ChatConfig> = {
		vendorId: "MISTRAL",
		model: "mistral-medium-latest",
		instructions: ""
	}

	const getVendors = () => {
		return Object.entries(chatState.APP_CONFIG.VENDORS)
			.filter(([_key, vendor]) => vendor.ENABLED)
			.map(([key, vendor]) => ({
				id: key as VendorId,
				name: vendor.NAME
			}))
	}

	const getAvailableProjects = (vendorId: VendorId) => {
		return chatState.APP_CONFIG.VENDORS[vendorId].PROJECTS
	}

	const getAvailableModels = (vendorId: VendorId) => {
		return chatState.APP_CONFIG.VENDORS[vendorId].MODELS.map((model) => model.ID)
	}

	const getAgentName = () => {
		if (chatState.configEdited && !chatState.chat.config.name) {
			return "Uten navn*"
		}
		let name = chatState.chat.config.name || chatState.chat.config.model
		if (!name) {
			name = chatState.chat.config._id ? "Uten navn" : "Ny agent"
		}
		if (chatState.configEdited) {
			name += "*"
		}
		return name
	}

	const shareAgent = async () => {
		const fullURL = $derived(page.url.href)
		await navigator.clipboard.writeText(fullURL)
		alert("Agentens adresse er kopiert til utklippstavlen og kan limes inn i en mail eller melding for å deles med andre.\n\nNB: Alle med lenken kan bruke agenten.")
	}

	// Almost illegal effect, but we need to auto-select first available model when changing vendor in manual config
	$effect(() => {
		console.log("project effect ran, be careful")
		if (chatState.chat.config.vendorId) {
			const availableProjects = getAvailableProjects(chatState.chat.config.vendorId)
			if (!availableProjects.includes(chatState.chat.config.project)) {
				// Current project not available for selected vendor, set to first available
				if (!availableProjects[0]) {
					throw new Error(`No available projects for vendor ${chatState.chat.config.vendorId}`)
				}
				chatState.chat.config.project = availableProjects[0]
			}
		}
	})

	// Almost illegal effect again, but we need to auto-select first available model when changing vendor in manual config
	$effect(() => {
		console.log("model effect ran, be careful")
		if (chatState.chat.config.model) {
			const availableModels = getAvailableModels(chatState.chat.config.vendorId)
			if (!availableModels.includes(chatState.chat.config.model)) {
				// Current model not available for selected vendor, set to first available
				chatState.chat.config.model = availableModels[0] || ""
			}
		}
	})

	const onConfigTypeChange = (event: Event) => {
		const target = event.target as HTMLInputElement
		if (target.value === "predefined") {
			// Cache manual config
			manualConfigCache = {
				vendorId: chatState.chat.config.vendorId,
				project: chatState.chat.config.project,
				model: chatState.chat.config.model,
				instructions: chatState.chat.config.instructions
			}
			// Switch to predefined in actual chatConfig
			chatState.chat.config.vendorId = predefinedConfigCache.vendorId as VendorId
			chatState.chat.config.project = predefinedConfigCache.project as string
			chatState.chat.config.vendorAgent = predefinedConfigCache.vendorAgent
			delete chatState.chat.config.model
			delete chatState.chat.config.instructions
		} else {
			// Cache predefined config
			predefinedConfigCache = {
				vendorId: chatState.chat.config.vendorId,
				project: chatState.chat.config.project,
				vendorAgent: {
					id: chatState.chat.config.vendorAgent?.id || ""
				}
			}
			// Switch to manual in actual chatConfig
			chatState.chat.config.vendorId = manualConfigCache.vendorId as VendorId
			chatState.chat.config.project = manualConfigCache.project as string
			chatState.chat.config.model = manualConfigCache.model as string
			chatState.chat.config.instructions = manualConfigCache.instructions as string
			delete chatState.chat.config.vendorAgent
		}
	}
</script>

<!-- Chat Header -->
<div class="chat-header">
	<div class="chat-header-left">
		&nbsp;
	</div>
	<div class="chat-header-center">
		{#if chatState.configMode}
			<input type="text" id="agent-name" placeholder="Gi agenten et navn" bind:value={chatState.chat.config.name} />
		{:else}
			<h3>{getAgentName()}</h3>
		{/if}
		{#if !userCanEditConfig}
			<button class="icon-button" onclick={() => showDescription = !showDescription} title={showDescription ? "Skjul beskrivelse" : "Vis beskrivelse"}>
				<span class="material-symbols-rounded">
					{showDescription ? 'expand_less' : 'info'}
				</span>
			</button>
		{/if}
	</div>
	<div class="chat-header-right">
		<div class="chat-actions">
			{#if !chatState.configMode}
				<button class="icon-button" onclick={() => chatState.newChat()} title="Ny samtale">
					<span class="material-symbols-rounded">edit_square</span>
					<span class="widescreen-span">Ny samtale</span>
				</button>
				<ConversationExport bind:chat={chatState.chat} />
			{/if}
			{#if userCanEditConfig}
				{#if chatState.configMode && chatState.configEdited}
					<button onclick={() => chatState.chat.config = JSON.parse(JSON.stringify(chatState.initialConfig))} title="Test agent-konfigurasjon">
						<span class="material-symbols-rounded">
							history
						</span>
						<span class="widescreen-span">Reset</span>
					</button>
					<button onclick={() => chatState.configMode = !chatState.configMode} title="Test agent-konfigurasjon">
						<span class="material-symbols-rounded">
							experiment
						</span>
						<span class="widescreen-span">Test agent</span>
					</button>
				{:else}
					{#if chatState.configMode}
						<button class="icon-button" onclick={() => chatState.configMode = !chatState.configMode} title={chatState.configMode ? "Skjul konfigurasjon" : "Vis konfigurasjon"}>
							<span class="material-symbols-rounded">
								close
							</span>
						</button>
					{:else}
						<button class:icon-button={!chatState.configEdited} onclick={() => chatState.configMode = !chatState.configMode} title={chatState.configMode ? "Skjul konfigurasjon" : "Vis konfigurasjon"}>
							<span class="material-symbols-rounded">
								build
							</span>
							<span class="widescreen-span">Konfigurer</span>
						</button>
					{/if}
				{/if}
			{/if}
		</div>
	</div>
</div>

<!-- Show config toggle only available if user can edit, so no need to check that further on -->
{#if chatState.configMode}
	<div class="chat-config-container" transition:slide={{ duration: 200 }}>
		<div class="chat-config">
			<!-- Description -->
			<div class="config-section">
				<div class="config-item">
					<label for="description">Beskrivelse av agent</label>
					<GrowingTextArea id="description" style="textarea" initialRows={1} placeholder="Skriv en beskrivelse av agenten her..." bind:value={chatState.chat.config.description} />
				</div>
			</div>

			<!-- Publish options -->
			{#if canPublishChatConfig(chatState.user, chatState.APP_CONFIG.APP_ROLES)}
				<div class="config-section">
					<div class="config-item">
						<label for="publish-status">Publiseringsstatus</label>
						<select id="publish-status" bind:value={chatState.chat.config.type}>
							<option value="private">Privat</option>
							<option value="published">Publisert</option>
						</select>
					</div>
					{#if chatState.chat.config.type === "published"}
						<div class="config-item">
							<label for="access-groups">Tilgang</label>
							<select id="access-groups" bind:value={chatState.chat.config.accessGroups}>
								<option value="all">Alle</option>
							</select>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Config type selection -->
			{#if userCanEditPredefinedConfig}
				<div class="config-section">
					<div class="config-item radio-group">
						<label class="radio-label">
							<input type="radio" name="configType" value="manual" onchange={onConfigTypeChange} checked={!chatState.chat.config.vendorAgent} />
							Manuell konfigurasjon
						</label>
						<label class="radio-label">
							<input type="radio" name="configType" value="predefined" onchange={onConfigTypeChange} checked={Boolean(chatState.chat.config.vendorAgent)} />
							Leverandør-konfigurasjon
						</label>
					</div>
				</div>
			{/if}

			<!-- Model / vendor-agent -->
			<div class="config-section">
				<div class="config-item">
					<label for="vendor">KI-leverandør</label>
					<select id="vendor" bind:value={chatState.chat.config.vendorId}>
						{#each getVendors() as vendor}
							<option value={vendor.id}>{vendor.name}</option>
						{/each}
					</select>
				</div>
				{#if userCanEditPredefinedConfig}
					<div class="config-item">
						<label for="vendor-project">Prosjekt</label>
						<select id="vendor-project" bind:value={chatState.chat.config.project}>
							{#each getAvailableProjects(chatState.chat.config.vendorId) as projectId}
								<option value={projectId}>{projectId}</option>
							{/each}
						</select>
					</div>
				{/if}
				{#if !chatState.chat.config.vendorAgent}
				<div class="config-item">
					<label for="model">Modell</label>
					<select id="model" bind:value={chatState.chat.config.model}>
						{#each getAvailableModels(chatState.chat.config.vendorId) as modelId}
							<option value={modelId}>{modelId}</option>
						{/each}
					</select>
				</div>
				{/if}
			</div>

			<!-- Instructions (only for manual model config) -->
			{#if !chatState.chat.config.vendorAgent}
				<div class="config-section">
					<div class="config-item">
						<label for="instructions">Instruksjoner til modellen</label>
						<GrowingTextArea id="instructions" style="textarea" initialRows={1} placeholder="Skriv instruksjoner til modellen her..." bind:value={chatState.chat.config.instructions} />
					</div>
				</div>
			{/if}

			<!-- Vendor agent (only for predefined config) -->
			{#if chatState.chat.config.vendorAgent}
				<div class="config-section">
					<div class="config-item">
						<label for="vendorAgentId">Agent-id</label>
						<input id="vendorAgentId" placeholder="agent/prompt-id" type="text" bind:value={chatState.chat.config.vendorAgent.id} />
					</div>
				</div>
			{/if}
		</div>

		<!-- Actions (save and so on) -->
		<div class="config-actions">
			<div class="config-action-item">
				{#if chatState.chat.config._id}
					<button class="filled danger" onclick={chatState.deleteChatConfig}><span class="material-symbols-outlined">delete</span>Slett agent</button>
				{:else}
					&nbsp;
				{/if}
			</div>
			<div class="config-action-item right">
				{#if chatState.chat.config._id}
					<button class="filled" onclick={shareAgent}><span class="material-symbols-outlined">share</span>Del agent</button>	
					<button disabled={!chatState.configEdited} class="filled" onclick={chatState.updateChatConfig}><span class="material-symbols-outlined">save</span>Lagre endringer</button>
				{:else}
					<button disabled={!chatState.configEdited} class="filled" onclick={chatState.saveChatConfig}><span class="material-symbols-outlined">save</span> Lagre som ny agent</button>
				{/if}
			</div>
		</div>
		
		<!-- Config info-box -->
		{#if chatState.configEdited}
			<div class="info-box">
				<span class="material-symbols-outlined">info</span><span>Test endringene dine<span class="chat-input-visible-span">&nbsp;i fullskjerm</span> ved å klikke på "Test agent" oppe i høyre hjørne. Klikk på "Konfigurer" igjen for å gå tilbake til redigering.</span>
			</div>
		{/if}
	</div>
{/if}

{#if showDescription}
	<div class="info-box" transition:slide={{ duration: 200 }}>
		<span class="material-symbols-outlined">info</span>
		{#if chatState.chat.config.description}
			{chatState.chat.config.description}
		{:else}
			<em>Ingen beskrivelse tilgjengelig for denne agenten.</em>
		{/if}
	</div>
{/if}

<style>
	.chat-header, .chat-config-container {
		max-width: 50rem;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
		padding: 0 0.5rem;
	}
	.chat-header {
		height: var(--header-height);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-shrink: 0;
	}
	.chat-header-left {
		min-width: 3rem;
		visibility: hidden;
		flex: 1;
	}
	.chat-header-center {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.chat-header-right {
		display: flex;
		flex: 1;
		justify-content: right;
	}
	.chat-actions {
		display: flex;
		gap: 0.25rem;
	}

	.chat-config-container {
		margin-bottom: 2rem;
	}
	.config-section, .config-actions {
		display: flex;
		padding: 1rem 0;
	}
	.config-section {
		column-gap: 0.5rem;
		border-bottom: 1px solid var(--color-primary-30);
		flex-wrap: wrap;
	}
	.config-item {
		display: flex;
		flex: 1;
		flex-direction: column;
	}
	.config-item.radio-group {
		flex-direction: row;
		align-items: center;
		gap: 1rem;
	}
	.config-actions {
		justify-content: space-between;
		gap: 1rem;
	}
	.config-action-item {
		display: flex;
		align-items: center;
	}
	.config-action-item.right {
		flex-shrink: 0;
		gap: 0.5rem;
	}

	.info-box {
		max-width: 50rem;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
		display: flex;
		font-size: smaller;
		background-color: var(--color-primary-20);
		gap: 0.5rem;
		align-items: center;
		padding: 0.5rem;
		border-radius: 10px;
	}

	label {
		color: var(--color-primary);
		font-size: small;
		display: inline-block;
		padding-bottom: 0.5rem;
	}
	select, input[type="text"] {
		width: calc(100% - 0.5rem);
		font-family: var(--font-family);
		font-size: inherit;
		padding: 0.25rem;
	}
	select {
		border: none;
		border-bottom: 0px solid var(--color-primary);
		background-color: inherit;
	}
	select:hover, input[type="radio"]:hover, .radio-label:hover {
		background-color: var(--color-primary-20);
		cursor: pointer;
	}

	.widescreen-span {
		display: none;
	}

	.chat-input-visible-span {
		display: none;
	}

	/* If screen wide enough, display some text */
	@media screen and (min-width: 40rem) {
		.widescreen-span {
			display: inline;
		}
	}

	/* If large enough screen, user can test while config is open */
	@media screen and (min-height: 64rem) and (min-width: 40rem) {
		.chat-input-visible-span {
			display: inline;
		}
	}
</style>
