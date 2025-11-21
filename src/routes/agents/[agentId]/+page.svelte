<script lang="ts">
	import { page } from "$app/state"
	import AgentComponent from "$lib/components/Agent/AgentComponent.svelte"

	// Derive agent id from the page params (it goddamn should be string, look at where it is located...)
	const agentId: string = $derived(page.params.agentId) as string
</script>

<div style="height: 100%; box-sizing: border-box; padding: 2rem 0rem;">
  <AgentComponent {agentId} />
</div>
