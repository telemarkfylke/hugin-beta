<script lang="ts">
	import type { AgentStateHandler, ReadonlyAgentState } from "$lib/types/agent-state"

	type Props = {
		agentStateHandler: AgentStateHandler
	}
	let { agentStateHandler }: Props = $props()

  let vectorStoreFiles = $state(new DataTransfer().files)

  const submitFiles = () => {
		if (vectorStoreFiles.length > 0) {
			agentStateHandler.addConversationVectorStoreFiles(vectorStoreFiles)
			vectorStoreFiles = new DataTransfer().files // Clear files after submission
		}
	}

  // Helper function
	const getAllowedVectorStoreFileMimeTypes = (agentState: ReadonlyAgentState): string[] | "loading" | "error" => {
		if (agentState.agentInfo.error) {
			return "error"
		}
		if (agentState.agentInfo.isLoading || !agentState.agentInfo.value) {
			return "loading"
		}
		return agentState.agentInfo.value.allowedMimeTypes.vectorStoreFiles
	}
</script>

<div>
  {#if agentStateHandler.agentState.currentConversation.isLoading}
    <p>Laster filer...</p>
  {:else if agentStateHandler.agentState.currentConversation.error}
    <p>Feil ved lasting av filer i nåværende samtale: {agentStateHandler.agentState.currentConversation.error}</p>
  {:else if agentStateHandler.agentState.currentConversation.value.vectorStoreFiles.length === 0}
    <p>Ingen filer her</p>
  {:else}
    {#each agentStateHandler.agentState.currentConversation.value.vectorStoreFiles as vectorStoreFile}
      <div>
        {vectorStoreFile.name} - {vectorStoreFile.status}
        <button onclick={() => agentStateHandler.deleteConversationVectorStoreFile(vectorStoreFile.id)}>SLÆTT</button>
        <a href="/api/agents/{agentStateHandler.agentState.agentId}/conversations/{agentStateHandler.agentState.currentConversation.value.id}/vectorstorefiles/{vectorStoreFile.id}">Last ned (link)</a>
      </div>
    {/each}
  {/if}
  <div id="vector-store-file-upload-container">
    {#if getAllowedVectorStoreFileMimeTypes(agentStateHandler.agentState) === "loading"}
      <p>Laster tillatte filtyper...</p>
    {:else if getAllowedVectorStoreFileMimeTypes(agentStateHandler.agentState) === "error"}
      <p>Feil ved lasting av tillatte filtyper.</p>
    {:else if getAllowedVectorStoreFileMimeTypes(agentStateHandler.agentState).length === 0}
      <p>Opplasting av kunnskap er ikke mulig på denne agenten.</p>
    {:else}
      <span>Last opp filer som agenten kan søke i:</span>
      <input bind:files={vectorStoreFiles} type="file" id="vector-store-file-upload" multiple accept={(getAllowedVectorStoreFileMimeTypes(agentStateHandler.agentState) as string[]).join(",")} />
      {#if vectorStoreFiles.length > 0}
        <button type="button" onclick={submitFiles}>Last opp {vectorStoreFiles.length} filer</button>
        <button type="reset" onclick={() => { vectorStoreFiles = new DataTransfer().files; }}>Clear Files ({vectorStoreFiles.length})</button>
      {/if}
    {/if}
  </div>
</div>
