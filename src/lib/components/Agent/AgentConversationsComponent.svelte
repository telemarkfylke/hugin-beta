<script lang="ts">
  import type { AgentStateHandler } from "$lib/types/agent-state";

  type Props = {
    agentStateHandler: AgentStateHandler;
  };
  let { agentStateHandler }: Props = $props()
</script>

<div>
  <p>Previous conversations with {agentStateHandler.agentState.agentId}:</p>
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
        <button onclick={() => agentStateHandler.loadConversation(conversation.id)}>Conversation: {conversation.id} - {conversation.name}</button>
      </div>
    {/each}
  {/if}
</div>
