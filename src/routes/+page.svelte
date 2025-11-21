<script lang="ts">
import AgentComponent from "$lib/components/Agent/AgentComponent.svelte"
import type { Agent } from "../lib/types/agents"

const getAgents = async (): Promise<Agent[]> => {
	const res = await fetch("/api/agents")
	const data = await res.json()
	if (!res.ok) {
		throw new Error(data.message || "Failed to fetch agents")
	}
	return data.agents
}
</script>
<div class="page-content">
  {#await getAgents() then agents}
    <div class="left-menu">
      <h2>Agents</h2>
      {#if agents.length === 0}
        <p>No agents found. Go play with yourself (or create a new agent)</p>
      {/if}
      {#each agents as agent}
        <div>
          <a href="/agents/{agent._id}">{agent.name}</a>
        </div>
      {/each}
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
  .left-menu {
    max-width: 250px;
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .right-content {
    flex: 1;
    padding-left: 20px;
  }
</style>