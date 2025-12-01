<script lang="ts">
	import { markdownFormatter } from "$lib/formatting/markdown-formatter.ts"
	import AgentChatInput from "./AgentChatInput.svelte"
	import AgentConversations from "./AgentConversations.svelte"
	import AgentInfo from "./AgentInfo.svelte"
	import { createAgentState } from "./AgentState.svelte.ts"


	// Input props
	let { agentId } = $props()

	// State
	const agentStateHandler = createAgentState()
	$effect(() => {
		// Initialize or change agent when agentId prop changes
		// It is not reccommended to change state in effect, but this is ONLY dependent on prop change, so it might be acceptable.
		agentStateHandler.changeAgent(agentId) // This resets, as we need to load new agent data, should probs set loading state here as well
	})

	let menuOpen = $state(false)
  const toggleMenu = () => {
    menuOpen = !menuOpen
  }
</script>

<div class="agent-container">
  <div class="agent-menu-bar">
    <div class="agent-menu-bar-left">
      <button class="conv-btn" onclick={toggleMenu}>{agentId} {menuOpen ? '＾' : 'ｖ'}</button>
      {#if agentStateHandler.agentState.currentConversation.value.id}
        <span> Conversation: {agentStateHandler.agentState.currentConversation.value.name} (ID: {agentStateHandler.agentState.currentConversation.value.id})</span>
      {/if}
    </div>
    <div class="agent-menu-bar-right">
      <button class="restart-btn" title="Start ny chat" onclick={agentStateHandler.clearConversation}><img src="/images/chat-notification_17178348.png" alt="Restart conversation"></button>
    </div>
  </div>
  <div class="agent-menu" class:open={menuOpen}>
    <AgentInfo agentInfo={agentStateHandler.agentState.agentInfo} />
    <h3>Agentinnstillinger</h3>
    <p>Yada yada yada skriv instruksjoner eller no drit hvis det er tilgjengelig på agenten</p>
    <h3>Filer i denne samtalen</h3>
    <p>Yada yada filer osv</p>
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
      {#each Object.entries(agentStateHandler.agentState.currentConversation.value.messages) as [id, message]}
      <!-- Check if user or agent and handle, maybe handle some agent tools / processing as well eventually --> 
        {#if message.role === 'user'}
          <div id="message-{id}" class="user-message">
            {message.content.text || ''}
          </div>
        {:else}
          <div id="message-{id}" class="agent-message">
            {@html markdownFormatter(message.content.text || '')}
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
<div class="chat-input-container">
  <AgentChatInput postUserPrompt={agentStateHandler.postUserPrompt} addKnowledgeFilesToConversation={agentStateHandler.addKnowledgeFilesToConversation} />
</div>

<style>
  .agent-container {
    box-sizing: border-box; /* Include padding and border in total size, to avoid overflow */
    display: flex;
    flex-direction: column;
    height: calc(90vh - 45px - 120px); /* Trekk fra header + plass til input */
    max-height: calc(90vh - 45px - 120px);
    width: 1000px;
    margin: 0 auto;
    color: #333;
    margin-top: 10px;
    font-size: 18px;
    z-index: 50;
    overflow: hidden;
  }

  .chat-input-container {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 1000px;
    padding: 10px 0;
    z-index: 100;
  }

  .agent-menu-bar {
    display: flex;
    justify-content: space-between;
    
  }
  .agent-menu {
    margin-bottom: 0.5rem;
    padding: 1rem;
    border-radius: 2px;
    /* display: none;  <-- FJERN DENNE LINJEN */
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-height 0.3s ease, opacity 0.3s ease;
  }

  .conv-btn {
    border: 1px solid #ccc;
    border-radius: 5px;
    font-size: 0.9rem;
    font-weight: 500;
    background-color: #E7F2F3;
    cursor: pointer;
    color: #333;
    height: 40px;
    position: relative;
    z-index: 40;
    transition: background 0.15s ease, border-color 0.15s ease;
    box-shadow: 0 2px 4px rgba(44, 44, 44, 0.25);
    transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;
    
  }
  .conv-btn:hover {
    background: #CCDCDF;
    border-color: #666;
    
  }
  .restart-btn {
    position: absolute;
    top: 20px;
    left: 70px;
    z-index: 20;
    font-size: 12px;
    justify-content: center;
    display: flex;
    border: 1px solid #ccc;
    border-radius: 10px;
    padding: 6px 12px;
    cursor: pointer;
    width: 40px;
    height: 40px;
    background-color: #E7F2F3;
    box-shadow: 0 2px 4px rgba(44, 44, 44, 0.25);
    transition: background 0.2s, color 0.2s;
  }
  .restart-btn:hover {
    background: #CCDCDF;
    border-color: #666;
  }
  .agent-menu.open {
    max-height: 1000px; /* Må være større enn alt innholdet! */
    opacity: 1;
    visibility: visible;
    display: block;
    overflow-y: auto;

    display: block;
    margin-bottom: 1rem;
    border-radius: 5px;
    z-index: 30;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    background: rgba(255,255,255,0.3);
    border: 1px solid rgba(255,255,255,0.4);
    box-shadow: 0 2px 4px rgba(44, 44, 44, 0.25);
  }
  .agent-chat {
    flex: 1;
    padding: 0.3rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    
  }
  .user-message {
    align-self: flex-end;
    background-color: #D2E2E2;
    padding: 0.5rem;
    border-radius: 5px;
    margin-top: 20px;
  }
</style>