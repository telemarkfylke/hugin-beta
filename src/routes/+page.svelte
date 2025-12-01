<script lang="ts">
	import AgentComponent from "$lib/components/Agent/AgentComponent.svelte"
	import type { DBAgent } from "../lib/types/agents"
  import SideMenu from "$lib/components/Agent/sideMenu.svelte";

  let menuOpen = $state(true);

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
    {#await getAgents()}
      <p>Loading agents...</p>
    {:then agents}
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
    height: 100%;

  }
</style>