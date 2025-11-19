<script lang="ts">
    import AgentComponent from "$lib/components/Agent/AgentComponent.svelte";
    import SideMenu from "$lib/components/Agent/sideMenu.svelte";
  import type { Agent } from "../lib/types/agents";

  const getAgents = async (): Promise<Agent[]> => {
    const res = await fetch('/api/agents');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch agents');
    }
    return data.agents;
  };

  let menuOpen = $state(true); 
</script>
<div class="page-content">
  {#await getAgents() then agents}
  <div>
    <SideMenu {agents} bind:menuOpen />
  </div>
    <div class="right-content">
      <AgentComponent agentId={"mistral-conversation"} />
    </div>
  {:catch error}
    <p style="color: red;">Error: {error.stack || error.message}</p>
  {/await}
</div>

<style>

  .page-content {
    display: flex;
    gap: 2rem;
    height: 100%;

  }
  .right-content {
  flex: 1;
  padding-left: 20px;
  }
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  }
</style>