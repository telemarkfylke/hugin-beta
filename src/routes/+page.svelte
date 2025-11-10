<script>
  import { Agents } from "../lib/types/agents";

  const getAgents = async () => {
    const res = await fetch('/api/agents');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch agents');
    }
    return Agents.parse(data.agents);
  };
</script>
<main>
  <h1>MI6 Agents</h1>
  {#await getAgents() then agents}
    <div>
      {#if agents.length === 0}
        <p>No agents found. Go play with yourself (or create a new agent)</p>
      {/if}
      {#each agents as agent}
        <div>
          <h2>{agent.name}</h2>
          <a href="/agents/{agent._id}">Go to agent: {`/agents/${agent._id}`}</a>
          <p>{agent.description}</p>
          <pre>{JSON.stringify(agent.config, null, 2)}</pre>
        </div>
      {/each}
    </div>
  {:catch error}
    <p style="color: red;">Error: {error.stack || error.message}</p>
  {/await}
</main>