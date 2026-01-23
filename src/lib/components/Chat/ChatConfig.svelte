<script lang="ts">
	import { fade, slide } from "svelte/transition"
	import { canEditChatConfig, canEditPredefinedConfig, canPublishChatConfig } from "$lib/authorization"
	import type { ChatConfig, VendorId } from "$lib/types/chat"
	import GrowingTextArea from "../GrowingTextArea.svelte"
	import type { ChatState } from "./ChatState.svelte"

	type Props = {
		chatState: ChatState
		showConfig: boolean
	}

	let { chatState, showConfig }: Props = $props()

	const initialConfig: ChatConfig = JSON.parse(JSON.stringify(chatState.chat.config))

	$effect(() => {
		chatState.configEditMode = JSON.stringify(chatState.chat.config) !== JSON.stringify(initialConfig)
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

{#snippet configTypeSelect()}
	{#if canEditPredefinedConfig(chatState.user, chatState.APP_CONFIG.APP_ROLES)}
		<div class="config-type-selection config-section">
			<label>
				<input type="radio" name="configType" value="manual" onchange={onConfigTypeChange} checked={!chatState.chat.config.vendorAgent} />
				Manuell konfigurasjon
			</label>
			<label>
				<input type="radio" name="configType" value="predefined" onchange={onConfigTypeChange} checked={!!chatState.chat.config.vendorAgent} />
				Forhåndsdefinert konfigurasjon hos leverandør
			</label>
		</div>
	{/if}
{/snippet}

{#snippet publishStatusSelect()}
	{#if canPublishChatConfig(chatState.user, chatState.APP_CONFIG.APP_ROLES)}
		<div class="config-section vendor-model-details">
			<div>
				<label for="publish-status">Publiseringsstatus</label>
				<br />
				<select id="publish-status" bind:value={chatState.chat.config.type}>
					<option value="private">Privat</option>
					<option value="published">Publisert</option>
				</select>
			</div>
			{#if chatState.chat.config.type === "published"}
				<div>
					<label for="access-groups">Tilgang</label>
					<br />
					<select id="access-groups" bind:value={chatState.chat.config.accessGroups}>
						<option value="all">Alle</option>
					</select>
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet vendorSelect()}
	<div>
		{#if canEditChatConfig(chatState.chat, chatState.user, chatState.APP_CONFIG.APP_ROLES)}
			<label for="vendor">KI-leverandør</label>
			<br />
			<select id="vendor" bind:value={chatState.chat.config.vendorId}>
				{#each getVendors() as vendor}
					<option value={vendor.id}>{vendor.name}</option>
				{/each}
			</select>
		{:else}
			<p><strong>KI-leverandør:</strong> {chatState.APP_CONFIG.VENDORS[chatState.chat.config.vendorId].NAME}</p>
		{/if}
	</div>
{/snippet}

{#snippet projectSelect()}
	{#if canEditPredefinedConfig(chatState.user, chatState.APP_CONFIG.APP_ROLES)}
		<div>
			<label for="vendor-project">Prosjekt</label>
			<br />
			<select id="vendor-project" bind:value={chatState.chat.config.project}>
				{#each getAvailableProjects(chatState.chat.config.vendorId) as projectId}
					<option value={projectId}>{projectId}</option>
				{/each}
			</select>
		</div>
	{/if}
{/snippet}

{#snippet vendorAgentIdInput()}
	{#if chatState.chat.config.vendorAgent}
		{#if canEditPredefinedConfig(chatState.user, chatState.APP_CONFIG.APP_ROLES)}
			<div>
				<label for="vendorAgentId">Agent-id</label>
				<br />
				<input id="vendorAgentId" placeholder="Skriv in id på prompt eller agent fra leverandør" type="text" bind:value={chatState.chat.config.vendorAgent.id} />
			</div>
		{:else}
			<p><strong>Agent-id:</strong>{chatState.chat.config.vendorAgent.id}</p>
		{/if}
	{/if}
{/snippet}

{#snippet modelSelect()}
	{#if chatState.chat.config.model}
		{#if canEditChatConfig(chatState.chat, chatState.user, chatState.APP_CONFIG.APP_ROLES)}
			<div>
				<label for="model">Modell</label>
				<br />
				<select id="model" bind:value={chatState.chat.config.model}>
					{#each getAvailableModels(chatState.chat.config.vendorId) as modelId}
						<option value={modelId}>{modelId}</option>
					{/each}
				</select>
			</div>
		{:else}
			<p><strong>Modell:</strong> {chatState.chat.config.model}</p>
		{/if}
	{/if}
{/snippet}

{#snippet instructionsInput()}
	{#if chatState.chat.config.model}
		{#if canEditChatConfig(chatState.chat, chatState.user, chatState.APP_CONFIG.APP_ROLES)}
			<div class="config-section">
				<label for="instructions">Instruksjoner til modellen</label>
				<GrowingTextArea id="instructions" style="textarea" initialRows={3} placeholder="Skriv instruksjoner til modellen her..." bind:value={chatState.chat.config.instructions} />
			</div>
		{:else}
			<p><strong>Instruksjoner til modellen:</strong> {chatState.chat.config.instructions}</p>
		{/if}
	{/if}
{/snippet}

{#if showConfig}
	<div class="chat-config-container" transition:slide={{ duration: 200 }}>
		<div class="chat-config">
			{@render configTypeSelect()}
			{@render publishStatusSelect()}
			<div class="vendor-model-details config-section">
				{@render vendorSelect()}
				{@render projectSelect()}
				{@render vendorAgentIdInput()}
				{@render modelSelect()}
			</div>
			{@render instructionsInput()}

			{#if canEditChatConfig(chatState.chat, chatState.user, chatState.APP_CONFIG.APP_ROLES) && chatState.configEditMode}
				<div  transition:fade={{ duration: 100 }}>
					<details class="config-section">
						<summary>Jeg er fornøyd og vil lagre konfigurasjonen</summary>
						<div class="config-metadata">
							<div class="config-section">
								<label for="agent-name">Navn på agent</label>
								<br />
								<input placeholder="Agentnavn..." id="agent-name" type="text" bind:value={chatState.chat.config.name} />
							</div>
							<div class="config-section">
								<label for="description">Beskrivelse av agent</label>
								<br />
								<GrowingTextArea id="description" style="textarea" initialRows={3} placeholder="Skriv en beskrivelse av agenten her..." bind:value={chatState.chat.config.description} />
							</div>
						</div>
					{#if chatState.chat.config._id}
							<button class="filled" onclick={chatState.updateChatConfig}><span class="material-symbols-outlined">save</span>Lagre endringer</button>
						{:else}
							<button class="filled" onclick={chatState.saveChatConfig}><span class="material-symbols-outlined">save</span> Lagre som ny agent</button>
						{/if}
					</details>
				</div>
			{/if}
		</div>
		<!-- Dev settings
		<div class="checkboxes">
			<input type="checkbox" id="stream" bind:checked={chatState.streamResponse} />
			<label for="stream">Stream svar</label>
			<br />
			<input type="checkbox" id="debug" bind:checked={debug} />
			<label for="debug">Debug Chat Config</label>
			{#if debug}
				<br />
				{JSON.stringify(chatState.chat.config, null, 2)}
			{/if}
		</div>
		-->
		{#if chatState.configEditMode}
			<div class="info-box">
				<span class="material-symbols-outlined">info</span>Test endringene dine ved å sende en melding i chatten nedenfor. Når du er fornøyd, kan du lagre konfigurasjonen.
			</div>
		{/if}
	</div>

{/if}

<style>
	.chat-config-container {
		margin-bottom: 2rem;
	}
	.chat-config {
		border-bottom: 0px solid var(--color-primary);
	}
	.config-section {
		margin: 1rem 0;
	}
	.vendor-model-details {
		display: flex;
		gap: 0rem 0.5rem;
		flex-wrap: wrap;
	}
	label {
		font-size: small;
	}
	.config-type-selection {
		display: flex;
		gap: 0rem 1rem;
		margin-bottom: 0.5rem;
	}
	select, input[type="text"] {
		width: 100%;
		font-family: var(--font-family);
		font-size: inherit;
		padding: 0.25rem;
		margin-bottom: 0.5rem;
	}
	select {
		border: none;
		color: var(--color-primary);
		border-bottom: 0px solid var(--color-primary);
		background-color: inherit;
	}
	select:hover {
		background-color: var(--color-primary-20);
		cursor: pointer;
	}
	input[type="text"] {
		border: none;
		border-bottom: 0px solid var(--color-primary);
	}
	.info-box {
		font-size: smaller;
		display: flex;
		background-color: var(--color-primary-20);
		gap: 0.5rem;
		align-items: center;
		padding: 0.5rem;
		border-radius: 10px;
	}
</style>
