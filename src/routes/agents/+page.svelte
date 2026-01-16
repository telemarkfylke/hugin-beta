<script lang="ts">
    import type { PageProps } from "./$types";


  let { data }: PageProps = $props()
</script>

<h1>Agenter</h1>
<div>
  {#each data.agents as agent}
    <a href={`/agents/${agent.id}`}>
      <div class="agent">
        <h2>{agent.name}</h2>
        <p>{agent.description}</p>
        <p><strong>Vendor ID:</strong> {agent.vendorId}</p>
      </div>
    </a>
  {/each}
</div>

<style>
  
</style>