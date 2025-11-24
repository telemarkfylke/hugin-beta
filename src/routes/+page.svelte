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
    <div style="height: 100%; box-sizing: border-box; padding: 2rem 0rem;">
      <AgentComponent agentId={"mistral-conversation"} />
    </div>
  {:catch error}
    <p style="color: red;">Error: {error.stack || error.message}</p>
  {/await}
</div>

<style>

  .page-content {
    height: 100%;

  }
</style>