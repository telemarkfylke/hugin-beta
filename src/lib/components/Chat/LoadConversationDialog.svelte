<script lang="ts">
	import type { ChatState } from "./ChatState.svelte"

	type Props = {
		chatState: ChatState
	}

	let { chatState = $bindable() }: Props = $props()
</script>

{#if chatState.pendingConversationLoad}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="dialog-backdrop" onclick={() => chatState.cancelPendingConversationLoad()}>
		<div class="dialog" onclick={(e) => e.stopPropagation()}>
			<p>
				Denne samtalen var sist med <strong>{chatState.pendingConversationLoad.originalConfig.name || "en annen assistent"}</strong>. Vil du fortsette den samtalen der, eller ta historikken med hit til
				<strong>{chatState.chat.config.name || "denne assistenten"}</strong>?
			</p>
			<div class="dialog-actions">
				<button onclick={() => chatState.cancelPendingConversationLoad()}>Avbryt</button>
				<button onclick={() => chatState.continueWithCurrentAgent()}>Ta med hit</button>
				<button class="filled" onclick={() => chatState.continueWithOriginalAgent()}>Fortsett med {chatState.pendingConversationLoad.originalConfig.name || "opprinnelig assistent"}</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.dialog-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}
	.dialog {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		max-width: 26rem;
		width: 90%;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
	}
	.dialog p {
		margin: 0;
		line-height: 1.5;
	}
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
</style>
