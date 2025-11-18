<script lang="ts">
    import AgentComponent from "$lib/components/Agent/AgentComponent.svelte";
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
  <button class="toggle-btn" onclick={() => menuOpen = !menuOpen}>☰</button>
    <div class="left-menu" class:hidden={!menuOpen}>
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
  position: absolute;
  left: 0;
  top: 0;
  width: 250px;
  height: 100%;
  border-radius: 5px;
  flex-shrink: 0;
  z-index: 10;
  background-color:#E7F2F3;
  box-shadow: 0 2px 4px rgba(44, 44, 44, 0.25);
  color: #333;
  transition: left 0.3s;
}
.left-menu.hidden {
  left: -260px;
}
.left-menu a {
  display: block;
  color: #333;
  text-decoration: none;
  padding: 0.3rem 0.5rem;
  border-radius: 3px;
  margin-bottom: 0.2rem;
  transition: background 0.2s, color 0.2s;
}
.left-menu a:hover {
  background-color: #B2CBCF;
}
.toggle-btn {
  position: absolute;
  top: 20px;
  left: 10px;
  z-index: 20;
  font-size: 12px;
  justify-content: center;
  display: flex;
  border: 1px solid #ccc;
  border-radius: 10px;
  padding: 6px 12px;
  cursor: pointer;
  width: 30px;
  height: 30px;
  background-color: #B2CBCF;
  box-shadow: 0 2px 4px rgba(44, 44, 44, 0.25);
  transition: background 0.2s, color 0.2s;
}
.toggle-btn:hover {
  background-color: #E7F2F3;
}
h2 {
  justify-content: center;
  display: flex;
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