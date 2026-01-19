<script lang="ts">
	import { canEditChatConfig, canEditPredefinedConfig } from "$lib/authorization"
	import type { ChatConfig, VendorId } from "$lib/types/chat"
	import GrowingTextArea from "../GrowingTextArea.svelte"
	import type { ChatState } from "./ChatState.svelte"

	type Props = {
		chatState: ChatState
		showConfig: boolean
	}

	let { chatState, showConfig }: Props = $props()

	let debug: boolean = $state(false)

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

{#snippet vendorSelect()}
	<label class="bold" for="vendor">KI-leverandør</label>
	<br />
	<select id="vendor" bind:value={chatState.chat.config.vendorId}>
		{#each getVendors() as vendor}
			<option value={vendor.id}>{vendor.name}</option>
		{/each}
	</select>
	{#if canEditPredefinedConfig(chatState.user, chatState.APP_CONFIG.APP_ROLES)}
		<select id="vendor-project" bind:value={chatState.chat.config.project}>
			{#each getAvailableProjects(chatState.chat.config.vendorId as keyof typeof chatState.APP_CONFIG.VENDORS) as projectId}
				<option value={projectId}>{projectId}</option>
			{/each}
		</select>
	{/if}
{/snippet}

{#snippet predefinedConfiguration()}
	{#if canEditPredefinedConfig(chatState.user, chatState.APP_CONFIG.APP_ROLES)}
		{@render vendorSelect()}
		<br />
		<label class="bold" for="vendorAgentId">Agent-id</label>
		<br />
		<input id="vendorAgentId" type="text" bind:value={(chatState.chat.config.vendorAgent as { id: string }).id} />
	{:else}
		Legg inn noe predefinert-agent info her senere
	{/if}
{/snippet}

{#snippet manualConfiguration()}
	{#if canEditChatConfig(chatState.chat, chatState.user, chatState.APP_CONFIG.APP_ROLES)}
		{@render vendorSelect()}
		<br />
		<label class="bold" for="model">Modell</label>
		<br />
		<select id="model" bind:value={chatState.chat.config.model}>
			{#each getAvailableModels(chatState.chat.config.vendorId as keyof typeof chatState.APP_CONFIG.VENDORS) as modelId}
				<option value={modelId}>{modelId}</option>
			{/each}
		</select>
		<br />
		<label class="bold" for="instructions">Instruksjoner til modellen</label>
		<GrowingTextArea id="instructions" bind:value={chatState.chat.config.instructions} />
	{:else}
		<p>Bare legg inn noe info om hvordan denne chatten er satt opp her senere</p>
	{/if}
{/snippet}

{#if showConfig}
	<div class="chat-config">
		{#if canEditPredefinedConfig(chatState.user, chatState.APP_CONFIG.APP_ROLES)}
			<div class="config-type-selection">
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
		{#if chatState.chat.config.vendorAgent}
			{@render predefinedConfiguration()}
		{:else}
			{@render manualConfiguration()}
		{/if}
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
		<div class="config-metadata">
			<p><strong>Konfigurasjon ID:</strong> {chatState.chat.config._id || "Ny konfigurasjon"}</p>
			<input type="text" bind:value={chatState.chat.config.name} />
			<input type="text" bind:value={chatState.chat.config.description} />
		</div>
		{#if chatState.chat.config._id}
			<button onclick={chatState.updateChatConfig}>Oppdater konfigurasjon</button>
		{:else}
			<button onclick={chatState.saveChatConfig}>Lagre konfigurasjon</button>
		{/if}
	</div>
{/if}

<style>
	.chat-config {
		padding-bottom: 1rem;
		border-bottom: 2px solid black;
	}
	label.bold {
		font-weight: bold;
	}
	select {
		min-width: 10rem;
		font-family: var(--font-family);
		padding: 0.25rem;
		margin-bottom: 0.5rem;
	}
	.checkboxes {
		margin-top: 0.5rem;
	}
</style>
