<script lang="ts">
  import { page } from "$app/state";
  import AgentComponent from "$lib/components/Agent/AgentComponent.svelte";
  import SideMenu from "$lib/components/Agent/sideMenu.svelte";
  import type { Agent } from "$lib/types/agents";
  
  // Derive agent id from the page params (it goddamn should be string, look at where it is located...)
  const agentId: string = $derived(page.params.agentId) as string;

  // Add missing variables
  let menuOpen = $state(true);
  
  const getAgents = async (): Promise<Agent[]> => {
    const res = await fetch('/api/agents');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch agents');
    }
    return data.agents;
  };
</script>

{#await getAgents() then agents}
  <div>
    <SideMenu {agents} bind:menuOpen />
  </div>
{:catch error}
  <div>
    <p style="color: red;">Error loading agents: {error.message}</p>
  </div>
{/await}

<div style="height: 100%; box-sizing: border-box; padding: 2rem 0rem;">
  <AgentComponent {agentId} />
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