<script lang="ts">
	import AgentComponent from "$lib/components/Agent/AgentComponent.svelte"
	import { GetAgentsResponse } from "$lib/types/api-responses"
	import type { DBAgent } from "../lib/types/agents"

	const getAgents = async (): Promise<DBAgent[]> => {
		const res = await fetch("/api/agents")
		if (!res.ok) {
			const resData = await res.json()
			throw new Error(resData.message || "Failed to fetch agents")
		}
		const data = GetAgentsResponse.parse(await res.json())
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
    <h2>Conversations</h2>
    <a href="/conversations">Go to Conversations</a>
    <h2>Vector stores</h2>
    <a href="/vectorstores">Go to Vector Stores</a>
  </div>
  <div class="right-content">
    <AgentComponent agentId={"mistral-conversation"} />
  </div>
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