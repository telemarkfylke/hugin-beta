<script lang="ts">
  import { onMount } from "svelte";
  import { createAgentState } from "./AgentState.svelte.ts";
  import AgentConversationsComponent from "./AgentConversationsComponent.svelte";
  import { markdownFormatter } from "$lib/formatting/markdown-formatter.ts";
    import AgentChatInput from "./AgentChatInput.svelte";

  let { agentId } = $props()

  const agentStateHandler = createAgentState()
  $effect(() => {
    // Initialize or change agent when agentId prop changes
    // It is not reccommended to change state in effect, but this is ONLY dependent on prop change, so it might be acceptable.
    agentStateHandler.changeAgent(agentId) // This resets, as we need to load new agent data, should probs set loading state here as well
  })
  
  onMount(() => {
    // Any side-effects or initialization can go here, but dont think we need any
    console.log("Agent component mounted with agentId:", agentId);
  });

</script>

<div class="agent-container">
  <h2>{agentStateHandler.agentState.agentId}</h2>
  <div>
    <p>Current Conversation ID: {agentStateHandler.agentState.currentConversation.value.id}</p>
    {#if agentStateHandler.agentState.currentConversation.isLoading}
      <p>Loading conversation...</p>
    {:else if agentStateHandler.agentState.currentConversation.error}
      <p>Error loading conversation: {agentStateHandler.agentState.currentConversation.error}</p>
    {:else if !agentStateHandler.agentState.currentConversation.value || Object.keys(agentStateHandler.agentState.currentConversation.value.messages).length === 0}
      <p>No messages in current conversation.</p>
    {:else}
      {#each Object.entries(agentStateHandler.agentState.currentConversation.value.messages) as [id, message]}
        <div id="message-{id}">
          {@html markdownFormatter(message.content || '')}
        </div>
      {/each}
    {/if}
  </div>
  <AgentChatInput postUserPrompt={agentStateHandler.postUserPrompt} addKnowledgeFilesToConversation={agentStateHandler.addKnowledgeFilesToConversation} />
  <AgentConversationsComponent {agentStateHandler} />
</div>

<style>
.agent-container {
  border: 1px solid #ccc;
  padding: 1rem;
  border-radius: 8px;
}
#user-prompt {
  /* field-sizing: content; */
  min-height: 4rem; /* Optional: Set a minimum height for better visual presentation */
  max-height: 5rem;
}
</style>
