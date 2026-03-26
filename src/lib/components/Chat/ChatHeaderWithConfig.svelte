<script lang="ts">
	import { slide } from "svelte/transition"
	import { canEditChatConfig } from "$lib/authorization"
	import type { ChatState } from "./ChatState.svelte"
	import ConversationExport from "./ConversationExport.svelte"
	import ChatConfigPanel from "./ChatConfigPanel.svelte"
	import NewChatDialog from "./NewChatDialog.svelte"

	type Props = {
		chatState: ChatState
	}

	let { chatState = $bindable() }: Props = $props()

	let showDescription: boolean = $state(false)
	let showNewChatDialog: boolean = $state(false)

	const STORAGE_KEY = "hugin_skip_new_chat_confirm"

	let userCanEditConfig = $derived(canEditChatConfig(chatState.chat, chatState.user, chatState.APP_CONFIG.APP_ROLES))

	const handleNewChat = () => {
		if (chatState.APP_CONFIG.NEW_CHAT_CONFIRM_DISABLED || localStorage.getItem(STORAGE_KEY) === "true") {
			chatState.newChat()
		} else {
			showNewChatDialog = true
		}
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
				<button class="header-action" onclick={handleNewChat} title="Ny samtale">
					<span class="material-symbols-rounded">edit_square</span>
					Ny samtale
				</button>
				{#if !chatState.APP_CONFIG.CONVERSATION_EXPORT_DISABLED}
					<ConversationExport bind:chat={chatState.chat} />
				{/if}
				{#if userCanEditConfig}
					<button class="header-action" class:glow={chatState.configEdited} onclick={() => chatState.configMode = true} title="Konfigurer agent">
						<span class="material-symbols-rounded">build</span>
						Konfigurer
					</button>
				{/if}
			{/if}
		</div>
	</div>
</div>

<ChatConfigPanel bind:chatState />

<NewChatDialog bind:show={showNewChatDialog} onConfirm={() => chatState.newChat()} />

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
