<script lang="ts">
	import type { AgentStateHandler, ReadonlyAgentState } from "$lib/types/agent-state"
	import type { AdvancedAgentPromptInput, AgentPrompt } from "$lib/types/requests"

	type Props = {
		agentStateHandler: AgentStateHandler
	}
	let { agentStateHandler }: Props = $props()

	// Internal state for this component
	let userPrompt: string = $state("")
	let chatFiles = $state(new DataTransfer().files)

	let vectorStoreFiles = $state(new DataTransfer().files)

	const fileToBase64 = (file: File): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.readAsDataURL(file)
			reader.onload = () => {
				if (typeof reader.result === "string") {
					resolve(reader.result)
				} else {
					reject(new Error("Failed to convert file to Base64"))
				}
			}
			reader.onerror = (error) => reject(error)
		})
	}

	// Simple helper for posting prompt, and clearing input
	const submitPrompt = async (): Promise<void> => {
		if (userPrompt.trim() === "") {
			return // Do not submit empty prompts
		}
		if (chatFiles.length === 0) {
			// No files, simple prompt, just send as string
			agentStateHandler.promptAgent(userPrompt)
			userPrompt = ""
			return
		}
		if (!agentStateHandler.agentState.agentInfo.value) {
			throw new Error("Agent info value is null, cannot process files. Yet?")
		}
		const fileInputs: AdvancedAgentPromptInput[] = []
		for (const file of Array.from(chatFiles)) {
			console.log("Processing file for prompt:", file.name, file.type, file.size)
			let fileType: "image" | "file" | null = null
			if (agentStateHandler.agentState.agentInfo.value.allowedMimeTypes.messageFiles.includes(file.type)) {
				fileType = "file"
			} else if (agentStateHandler.agentState.agentInfo.value.allowedMimeTypes.messageImages.includes(file.type)) {
				fileType = "image"
			} else {
				throw new Error(`File type ${file.type} of file ${file.name} is not allowed by the agent.`)
			}
			console.log("Converting file to base64...")
			let base64Url: string
			try {
				base64Url = await fileToBase64(file)
			} catch (error) {
				console.error("Error converting file to base64:", error)
				throw error
			}
			console.log("File converted to base64.")
			console.log(`Base64 URL: ${base64Url.substring(0, 100)}...`) // Log only the beginning for brevity
			const filePrompt: AdvancedAgentPromptInput =
				fileType === "file"
					? {
							type: "file",
							fileName: file.name,
							fileUrl: base64Url
						}
					: {
							type: "image",
							imageUrl: base64Url
						}
			fileInputs.push(filePrompt)
		}
		const combinedPrompt: AgentPrompt = JSON.parse(
			JSON.stringify([
				{
					role: "user",
					input: [
						...fileInputs,
						{
							type: "text",
							text: userPrompt
						}
					]
				}
			])
		)
		agentStateHandler.promptAgent(combinedPrompt)
		chatFiles = new DataTransfer().files // Clear chat files after submission
		userPrompt = ""
	}

	const submitFiles = () => {
		if (vectorStoreFiles.length > 0) {
			agentStateHandler.addConversationVectorStoreFiles(vectorStoreFiles)
			vectorStoreFiles = new DataTransfer().files // Clear files after submission
		}
	}

	// Helper function
	const getAllowedMessageFileMimeTypes = (agentState: ReadonlyAgentState): string[] | "loading" | "error" => {
		if (agentState.agentInfo.error) {
			return "error"
		}
		if (agentState.agentInfo.isLoading || !agentState.agentInfo.value) {
			return "loading"
		}
		return [...agentState.agentInfo.value.allowedMimeTypes.messageFiles, ...agentState.agentInfo.value.allowedMimeTypes.messageImages]
	}

	// Some element references
	let textArea: HTMLTextAreaElement
	let wrapDiv: HTMLDivElement
	/**
	 * As we wait for "textarea {field-sizing: content;}" to be supported in all browsers
	 * Magic is in CSS below, this JS just updates the data attribute on input
	 * Thank you to Chris Coyier and Stephen Shaw
	 * @link https://chriscoyier.net/2023/09/29/css-solves-auto-expanding-textareas-probably-eventually/
	 */
	const sneakyTextArea = () => {
		wrapDiv.setAttribute("data-replicated-value", textArea.value)
	}
	const submitOnEnter = (event: KeyboardEvent) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault()
			submitPrompt()
		}
	}
</script>

<div>
  <form onsubmit={(event: Event) => { event.preventDefault(); submitPrompt() }}>
    <div class="grow-wrap" bind:this={wrapDiv}>
      <textarea rows="1" bind:this={textArea} placeholder="Skriv et eller annet (shift + enter for ny linje)" name="prompt-input" id="prompt-input" oninput={sneakyTextArea} onkeydown={submitOnEnter} bind:value={userPrompt}></textarea>
    </div>
    <div id="actions">
      <div id="actions-left">
        <!-- WHOOOPS bruk dynamisk accept basert på agenten, og enable disable fileupload basert på agenten (https://platform.openai.com/docs/assistants/tools/file-search#supported-files), MISTRAL: PNG, JPEG, JPG, WEBP, GIF, PDF, DOCX, PPTX, EPUB, CSV, TXT, MD, XLSX --> 
        <div id="chat-file-upload-container">
					{#if getAllowedMessageFileMimeTypes(agentStateHandler.agentState) === "loading"}
						 <span>Laster...</span>
						<input type="file" disabled />
					{:else if getAllowedMessageFileMimeTypes(agentStateHandler.agentState) === "error"}
						<span>Feil ved lasting av tillatte filtyper: </span>
						<input type="file" disabled />
					{:else if getAllowedMessageFileMimeTypes(agentStateHandler.agentState).length === 0}
						<span>Filopplasting er ikke mulig på denne agenten</span>
					{:else}
						<span>Last opp filer til chat:</span>
          	<input bind:files={chatFiles} type="file" id="chat-file-upload" multiple accept={(getAllowedMessageFileMimeTypes(agentStateHandler.agentState) as string[]).join(",")} />
						{#if chatFiles.length > 0}
          		<button type="reset" onclick={() => { chatFiles = new DataTransfer().files; }}>Clear Files ({chatFiles.length})</button>
						{/if}
					{/if}
        </div>
        <div id="vector-store-file-upload-container">
          <span>Last opp filer til vector-store:</span>
          <input bind:files={vectorStoreFiles} type="file" id="vector-store-file-upload" multiple accept=".png,.jpeg,.jpg,.webp,.gif,.pdf,.docx,.pptx,.epub,.csv,.txt,.md,.xlsx,image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/epub+zip,text/csv,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
          {#if vectorStoreFiles.length > 0}
            <button type="button" onclick={submitFiles}>Last opp til vector-store ({vectorStoreFiles.length})</button>
            <button type="reset" onclick={() => { vectorStoreFiles = new DataTransfer().files; }}>Clear Files ({vectorStoreFiles.length})</button>
          {/if}
        </div>
      </div>
      <div id="actions-right">
        <button type="submit">Send</button>
      </div>
    </div>
  </form>
  {vectorStoreFiles.length}
</div>

<style>
  #actions {
    display: flex;
    justify-content: space-between;
  }

  /* START AUTO GROW TEXTAREA STYLES */
  .grow-wrap::after, #prompt-input {
    max-height: 8rem;
  }
  .grow-wrap {
    /* easy way to plop the elements on top of each other and have them both sized based on the tallest one's height */
    display: grid;
  }
  .grow-wrap::after {
    /* Note the weird space! Needed to preventy jumpy behavior */
    content: attr(data-replicated-value) " ";

    /* This is how textarea text behaves */
    white-space: pre-wrap;

    /* Hidden from view, clicks, and screen readers */
    visibility: hidden;
  }
  .grow-wrap > textarea {
    /* You could leave this, but after a user resizes, then it ruins the auto sizing */
    resize: none;

    /* Firefox shows scrollbar on growth, you can hide like this. */
    /* overflow: hidden; */
  }
  .grow-wrap > textarea,
  .grow-wrap::after {
    /* Identical styling required!! */
    border: 1px solid black;
    padding: 0.5rem;
    font: inherit;

    /* Place on top of each other */
    grid-area: 1 / 1 / 2 / 2;
  }
  /* END AUTO GROW TEXTAREA STYLES */
</style>