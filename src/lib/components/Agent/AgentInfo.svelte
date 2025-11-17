<script lang="ts">
  import type { AgentInfo } from "$lib/types/agent-state";

  type Props = {
    agentInfo: AgentInfo;
  };
  let { agentInfo }: Props = $props()
</script>

<div>
  {#if agentInfo.isLoading}
    <p>Loading agent info...</p>
  {:else if agentInfo.error}
    <p>Error loading agent info: {agentInfo.error}</p>
  {:else if !agentInfo.value}
    <p>No agent info available.</p>
  {:else}
    <h3>{agentInfo.value.name}</h3>
    <p>ID: {agentInfo.value._id}</p>
    <p>Description: {agentInfo.value.description}</p>
    <!-- Add more agent info fields as needed -->
  {/if}
</div>
