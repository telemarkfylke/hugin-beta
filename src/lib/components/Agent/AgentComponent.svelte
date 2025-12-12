<script lang="ts">
	import AgentChatInput from "./AgentChatInput.svelte"
	import AgentConversationMessage from "./AgentConversationMessage.svelte"
	import AgentConversations from "./AgentConversations.svelte"
	import AgentConversationVectorStoreFiles from "./AgentConversationVectorStoreFiles.svelte"
	import AgentInfo from "./AgentInfo.svelte"
	import { createAgentState } from "./AgentState.svelte.ts"

	type Props = {
		agentId: string
		conversationId: string | null
	}
	// Input props
	let { agentId, conversationId }: Props = $props()

	// State
	const agentStateHandler = createAgentState()
	$effect(() => {
		// Initialize or change agent when agentId prop changes
		// It is not reccommended to change state in effect, but this is ONLY dependent on prop change, so it might be acceptable.
		agentStateHandler.loadAgent(agentId, conversationId) // This resets, as we need to load new agent data, should probs set loading state here as well
	})

	let menuOpen = $state(false)

	const toggleMenu = () => {
		menuOpen = !menuOpen
	}
</script>

<div class="agent-container">
  <div class="agent-menu-bar">
    <div class="agent-menu-bar-left">
      <button onclick={toggleMenu}>{agentId} {menuOpen ? '⬆️' : '⬇️'}</button>
      {#if agentStateHandler.agentState.currentConversation.value.id}
        <span> Conversation: {agentStateHandler.agentState.currentConversation.value.name} (ID: {agentStateHandler.agentState.currentConversation.value.id})</span>
      {/if}
    </div>
    <div class="agent-menu-bar-right">
      <button onclick={agentStateHandler.clearCurrentConversation}>Start ny samtale</button>
    </div>
  </div>
  <div class="agent-menu" class:open={menuOpen}>
    <AgentInfo agentInfo={agentStateHandler.agentState.agentInfo} />
    <h3>Agentinnstillinger</h3>
    <p>Yada yada yada skriv instruksjoner eller no drit hvis det er tilgjengelig på agenten</p>
    <h3>Kunnskap</h3>
    <AgentConversationVectorStoreFiles {agentStateHandler} />
    <h3>Lagre som ny agent?</h3>
    <p>Skal det være lov?</p>
    <h3>Samtale-logg (agent-spesifikt)</h3>
    <AgentConversations {agentStateHandler} />
  </div>
  <div class="agent-chat">
    {#if agentStateHandler.agentState.currentConversation.isLoading}
      <p>Loading conversation...</p>
    {:else if agentStateHandler.agentState.currentConversation.error}
      <p>Error loading conversation: {agentStateHandler.agentState.currentConversation.error}</p>
    {:else if !agentStateHandler.agentState.currentConversation.value || Object.keys(agentStateHandler.agentState.currentConversation.value.messages).length === 0}
      <p>No messages in current conversation.</p>
    {:else}
      {#each Object.values(agentStateHandler.agentState.currentConversation.value.messages) as message}
        <AgentConversationMessage {message} />
      {/each}
    {/if}
  </div>
  <AgentChatInput {agentStateHandler} />
</div>

<style>
  .agent-container {
    box-sizing: border-box; /* Include padding and border in total size, to avoid overflow */
    display: flex;
    flex-direction: column;
    max-width: 1280px;
    margin: 0 auto;
    border: 1px solid #ccc;
    height: 100%;
  }
  .agent-menu-bar {
    display: flex;
    justify-content: space-between;
  }
  .agent-menu {
    margin-bottom: 0.5rem;
    padding: 1rem;
    border-top: 1px solid #ccc;
    border-bottom: 1px solid #ccc;
    display: none;
  }
  .agent-menu.open {
    display: block;
    margin-bottom: 1rem;
  }
  .agent-chat {
    flex: 1;
    padding: 0.3rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
