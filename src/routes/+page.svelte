<script lang="ts">
<<<<<<< HEAD
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
=======
	import AgentComponent from "$lib/components/Agent/AgentComponent.svelte"
	import type { DBAgent } from "../lib/types/agents"

	const getAgents = async (): Promise<DBAgent[]> => {
		const res = await fetch("/api/agents")
		const data = await res.json()
		if (!res.ok) {
			throw new Error(data.message || "Failed to fetch agents")
		}
		return data.agents
	}
</script>
<div class="page-content">
  <div class="left-menu">
    {#await getAgents()}
      <p>Loading agents...</p>
    {:then agents}
      <h2>Agents</h2>
      {#if agents.length === 0}
        <p>No agents found. Go play with yourself (or create a new agent)</p>
      {/if}
      {#each agents as agent}
        <div>
          <a href="/agents/{agent._id}">{agent.name}</a>
        </div>
      {/each}
    {:catch error}
      <p style="color: red;">Error: {error.stack || error.message}</p>
    {/await}
  </div>
  <div class="right-content">
    <AgentComponent agentId={"mistral-conversation"} />
  </div>
>>>>>>> main
</div>

<style>

  .page-content {
    height: 100%;

  }
</style>