<script lang="ts">
  import type { ChatConfig } from "$lib/types/chat";
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
		vendorId: "mistral",
		vendorAgent: {
			id: ""
		}
	}
	let manualConfigCache: Partial<ChatConfig> = {
		vendorId: "mistral",
		model: "mistral-medium-latest",
		instructions: ""
	}

	const onConfigTypeChange = (event: Event) => {
		const target = event.target as HTMLInputElement
		if (target.value === "predefined") {
			// Cache manual config
			manualConfigCache = {
				vendorId: chatState.chat.config.vendorId,
				model: chatState.chat.config.model,
				instructions: chatState.chat.config.instructions
			}
			// Switch to predefined in actual chatConfig
			chatState.chat.config.vendorId = predefinedConfigCache.vendorId as string
			chatState.chat.config.vendorAgent = predefinedConfigCache.vendorAgent
			delete chatState.chat.config.model
			delete chatState.chat.config.instructions
		} else {
			// Cache predefined config
			predefinedConfigCache = {
				vendorId: chatState.chat.config.vendorId,
				vendorAgent: {
					id: chatState.chat.config.vendorAgent?.id || ""
				}
			}
			// Switch to manual in actual chatConfig
			chatState.chat.config.vendorId = manualConfigCache.vendorId as string
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
		<option value="openai">OpenAI</option>
		<option value="mistral">Mistral</option>
	</select>
{/snippet}

{#snippet predefinedConfiguration()}
	{@render vendorSelect()}
	<br />
	<label class="bold" for="vendorAgentId">Agent-id</label>
	<br />
	<input id="vendorAgentId" type="text" bind:value={(chatState.chat.config.vendorAgent as { id: string }).id} />
{/snippet}

{#snippet manualConfiguration()}
	{@render vendorSelect()}
	<br />
	<label class="bold" for="model">Modell</label>
	<br />
	<select id="model" bind:value={chatState.chat.config.model}>
		{#if chatState.chat.config.vendorId === "openai"}
			<option value="gpt-4o">GPT-4o</option>
			<option value="gpt-4">GPT-4</option>
		{:else if chatState.chat.config.vendorId === "mistral"}
			<option value="mistral-medium-latest">Mistral Medium</option>
			<option value="mistral-large-latest">Mistral Large</option>
		{/if}
	</select>
	<br />
	<label class="bold" for="instructions">Instruksjoner til modellen</label>
	<GrowingTextArea id="instructions" bind:value={chatState.chat.config.instructions} />
{/snippet}

{#if showConfig}
	<div class="chat-config">
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
