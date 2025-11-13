<script lang="ts">
  import { markdownFormatter } from "$lib/formatting/markdown-formatter.js";
  import { page } from "$app/state";
  import { parseSse } from "$lib/streaming.js";
  import AgentComponent from "$lib/components/Agent/AgentComponent.svelte";
  
  // Derive agent id from the page params (it goddamn should be string, look at where it is located...)
  const agentId: string = $derived(page.params.agentId) as string;

  const uploadFiles = async (conversationId: string | null): Promise<void> => {
    if (!conversationId) {
      console.error("Cannot upload files: conversationId is null");
      return;
    }
    // Hvis vi ikke har conversationId, må først starte opp en samtale her...
    // Post api/agents/{agentId}/conversations/{conversationId}/{vectorStoreId}/files
    const formData = new FormData();
    formData.append('stream', 'true');
    for (let i = 0; i < files.length; i++) {
      formData.append('files[]', files[i] as File);
    }
    try {
      const response = await fetch(`/api/agents/${agentId}/conversations/${conversationId}/files`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      if (!response.body) {
        throw new Error("Response body is null");
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8")
      while (true) {
        const { value, done } = await reader.read()
        const chatResponseText = decoder.decode(value, { stream: true })
        // console.log("Chat response text:", chatResponseText)
        const uploadResponse = parseSse(chatResponseText)
        for (const uploadResult of uploadResponse) {
          console.log("Upload result:", uploadResult)
          switch (uploadResult.event) {
            case 'conversation.document.uploaded':
              const { documentId, fileName } = uploadResult.data
              console.log(`Document uploaded: ${fileName} (ID: ${documentId})`)
              break;
            case 'conversation.document.processed':
              const { processedDocumentId, status } = uploadResult.data
              console.log(`Document processed: ID ${processedDocumentId}, status: ${status}`)
              break;
            default:
              console.warn("Unhandled upload result event:", uploadResult.event)
              break;
          }
        }
        if (done) break
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    }
  };

</script>

<div>
  <h1>{agentId}</h1>
  <AgentComponent {agentId} />
</div>
