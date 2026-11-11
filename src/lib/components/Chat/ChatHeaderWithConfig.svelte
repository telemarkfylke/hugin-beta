<script lang="ts">
	import { slide } from "svelte/transition"
	import { canEditChatConfig } from "$lib/authorization"
	import { getModelDisplayName } from "$lib/model-profiles"
	import ChatConfigPanel from "./ChatConfigPanel.svelte"
	import type { ChatState } from "./ChatState.svelte"
	import ConversationList from "./ConversationList.svelte"
	import LoadConversationDialog from "./LoadConversationDialog.svelte"
	import NewChatMenu from "./NewChatMenu.svelte"
	import {isStudentOnly} from "$lib/authorization"



	type Props = {
		chatState: ChatState
	}

	let { chatState = $bindable() }: Props = $props()

	let showDescription: boolean = $state(false)

	let userCanEditConfig = $derived(canEditChatConfig(chatState.chat, chatState.user, chatState.APP_CONFIG.APP_ROLES))
	let student = $derived(isStudentOnly( chatState.user, chatState.APP_CONFIG.APP_ROLES))

	if (isStudentOnly(chatState.user, chatState.APP_CONFIG.APP_ROLES)) {
		chatState.studiemodus = true
	}

	const getAgentName = () => {
		if (chatState.configEdited && !chatState.chat.config.name) {
			return "Uten navn*"
		}
		let name = chatState.chat.config.name || getModelDisplayName(chatState.chat.config, chatState.APP_CONFIG)
		if (!name) {
			name = chatState.chat.config._id ? "Uten navn" : "Ny assistent"
		}
		if (chatState.configEdited) {
			name += "*"
		}
		return name
	}
</script>

<!-- Chat Header -->
<div class="chat-header">
	<div class="chat-header-left">&nbsp;</div>
	<div class="chat-header-center">
		<h3>{getAgentName()}</h3>
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
				<NewChatMenu bind:chatState onNewChat={() => chatState.newChat()} exportDisabled={chatState.APP_CONFIG.CONVERSATION_EXPORT_DISABLED} />
				{#if chatState.canUseHistory}
					<ConversationList bind:chatState />
					<button
						class="header-action"
						class:active={!chatState.storeChat || chatState.hasUnsavedHistory}
						disabled={chatState.hasUnsavedHistory}
						onclick={() => chatState.toggleStoreChat()}
						title={chatState.hasUnsavedHistory
							? "Denne samtalen er låst i inkognito-tilstand (importert, eller startet i inkognito) og lagres ikke. Bryteren er deaktivert til du lagrer den via «Ny samtale»-menyen."
							: chatState.storeChat
								? "Samtalen lagres"
								: "Inkognito: samtalen lagres ikke"}
					>
						{#if chatState.hasUnsavedHistory}
							<span class="material-symbols-rounded">lock</span>
						{/if}
						Inkognito
					</button>
				
				{/if}
				{#if userCanEditConfig}
					<button class="header-action" class:glow={chatState.configEdited} onclick={() => chatState.configMode = true} title="Konfigurer assistent">
						<span class="material-symbols-rounded">build</span>
						Konfigurer
					</button>
				{/if}

				{#if userCanEditConfig || student} 
					<label class="toggle" class:active={chatState.studiemodus} title="Studiemodus">
						Studiemodus
						<input type="checkbox" role="switch" bind:checked={chatState.studiemodus}  />
						<span class="toggle-track" aria-hidden="true"></span>
					</label>
				{/if}
			{/if}
		</div>
	</div>
</div>

<ChatConfigPanel bind:chatState />


<LoadConversationDialog bind:chatState />

{#if showDescription}
	<div class="info-box" transition:slide={{ duration: 200 }}>
		<span class="material-symbols-outlined">info</span>
		{#if chatState.chat.config.description}
			{chatState.chat.config.description}
		{:else}
			<em>Ingen beskrivelse tilgjengelig for denne assistenten.</em>
		{/if}
	</div>
{/if}

<style>
	.chat-header {
		max-width: 50rem;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
		padding: 0 0.5rem;
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
		gap: 0.5rem;
	}
	button.header-action.glow {
		opacity: 1;
		color: var(--color-primary);
		animation: glow-pulse 2s ease-in-out infinite;
	}
	button.header-action.active {
		opacity: 1;
		color: var(--color-primary);
		background-color: var(--color-primary-20);
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.4rem;
		border-radius: 6px;
		font-size: 0.8125rem;
		white-space: nowrap;
		cursor: pointer;
		opacity: 0.7;
		transition:
			opacity 0.15s,
			background-color 0.15s;
	}
	.toggle:hover,
	.toggle.active {
		opacity: 1;
	}
	.toggle:hover {
		background-color: var(--color-primary-10);
	}
	.toggle.active {
		color: var(--color-primary);
	}
	.toggle input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.toggle-track {
		position: relative;
		flex-shrink: 0;
		width: 2.25rem;
		height: 1.25rem;
		border-radius: 1rem;
		background-color: var(--color-primary-30);
		transition: background-color 0.2s;
	}
	.toggle-track::after {
		content: "";
		position: absolute;
		top: 2px;
		left: 2px;
		width: calc(1.25rem - 4px);
		height: calc(1.25rem - 4px);
		border-radius: 50%;
		background-color: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
		transition: transform 0.2s ease;
	}
	.toggle input:checked + .toggle-track {
		background-color: var(--color-primary);
	}
	.toggle input:checked + .toggle-track::after {
		transform: translateX(1rem);
	}
	.toggle input:focus-visible + .toggle-track {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
	@keyframes glow-pulse {
		0%, 100% {
			box-shadow: 0 0 0 0 rgba(0, 82, 96, 0);
			background-color: var(--color-primary-10);
		}
		50% {
			box-shadow: 0 0 0 4px rgba(0, 82, 96, 0.2);
			background-color: var(--color-primary-20);
		}
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
</style>
