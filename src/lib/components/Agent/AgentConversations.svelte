<script lang="ts">
  import type { AgentStateHandler } from "$lib/types/agent-state";

  type Props = {
    agentStateHandler: AgentStateHandler;
  };
  let { agentStateHandler }: Props = $props()
</script>

<div>
  {#if agentStateHandler.agentState.conversations.isLoading}
    <p>Loading conversations...</p>
  {:else if agentStateHandler.agentState.conversations.error}
    <p>Error loading conversations: {agentStateHandler.agentState.conversations.error}</p>
  {:else if agentStateHandler.agentState.conversations.value.length === 0}
    <p>No previous conversations found.</p>
  {:else}
    {#each agentStateHandler.agentState.conversations.value as conversation}
      <div>
        <!--Kjør en change conversation, så blir det stilig-->
        <button class="conversation-btn" onclick={() => agentStateHandler.loadAgentConversation(conversation._id)}>Conversation: {conversation._id} - {conversation.name}</button>
      </div>
    {/each}
  {/if}
</div>

<style>
  .conversation-btn {
    background-color: #E7F2F3;
    color: #333;
    height: 30px;
    border-radius: 5px;
    transition: background 0.15s ease, border-color 0.15s ease;
    margin: 5px;
  }
  .conversation-btn:hover {
    background: #CCDCDF;
    border-color: #666;
  }
</style>