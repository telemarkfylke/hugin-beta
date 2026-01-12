<script lang="ts">
	import GrowingTextArea from "../GrowingTextArea.svelte"
	import type { ChatState } from "./ChatState.svelte"

	type Props = {
		chatState: ChatState
		showConfig: boolean
	}

	let { chatState, showConfig }: Props = $props()

	let debug: boolean = $state(false)
</script>

{#if showConfig}
	<div class="chat-config">
		<label class="bold" for="vendor">KI-leverandør</label>
		<br />
		<select id="vendor" bind:value={chatState.chat.config.vendorId}>
			<option value="openai">OpenAI</option>
			<option value="mistral">Mistral</option>
		</select>
		<br />
		{#if chatState.chat.config.vendorAgent}
			<p>Agent-id: {chatState.chat.config.vendorAgent.id}</p>
		{:else}
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
