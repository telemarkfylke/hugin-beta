<script lang="ts">
	import type { AgentStateHandler } from "$lib/types/agent-state"

	type Props = {
		agentStateHandler: AgentStateHandler
	}
	let { agentStateHandler }: Props = $props()
</script>

<div>
  {#if agentStateHandler.agentState.currentConversation.isLoading}
    <p>Loading files...</p>
  {:else if agentStateHandler.agentState.currentConversation.error}
    <p>Error loading current conversation files: {agentStateHandler.agentState.currentConversation.error}</p>
  {:else if agentStateHandler.agentState.currentConversation.value.vectorStoreFiles.length === 0}
    <p>Ingen filer her</p>
  {:else}
    {#each agentStateHandler.agentState.currentConversation.value.vectorStoreFiles as vectorStoreFile}
      <div>
        {vectorStoreFile.name} - {vectorStoreFile.status}
        <button onclick={() => agentStateHandler.deleteConversationVectorStoreFile(vectorStoreFile.id)}>SLÆTT</button>
        <a href="/api/agents/{agentStateHandler.agentState.agentId}/conversations/{agentStateHandler.agentState.currentConversation.value.id}/vectorstorefiles/{vectorStoreFile.id}">Last ned (link)</a>
      </div>
    {/each}
  {/if}
</div>
