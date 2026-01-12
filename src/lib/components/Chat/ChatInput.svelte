<script lang="ts">
	import type { ChatConfig } from "$lib/types/chat"
	import { VENDOR_SUPPORTED_MESSAGE_MIME_TYPES } from "$lib/vendor-constants"
	import FileDropZone from "../FileDropZone.svelte"
	import GrowingTextArea from "../GrowingTextArea.svelte"

	type Props = {
		chatConfig: ChatConfig
		sendMessage: (inputText: string, inputFiles: FileList) => Promise<void>
	}
	let { chatConfig, sendMessage }: Props = $props()

	// Determine allowed file mime types based on model/vendor
	let allowedMessageMimeTypes = $derived.by(() => {
		const supportedTypes = VENDOR_SUPPORTED_MESSAGE_MIME_TYPES[`${chatConfig.vendorId}-${chatConfig.model}`]
		if (!supportedTypes) {
			return []
		}
		return [...supportedTypes.file, ...supportedTypes.image]
	})

	// Internal state for this component
	let inputText: string = $state("")
	let inputFiles = $state(new DataTransfer().files)

	// Simple helper for posting prompt, and clearing input
	const submitPrompt = (): void => {
		if (inputText.trim() === "" && inputFiles.length === 0) {
			return // Do not submit empty prompts
		}
		const textToSend = inputText
		const filesToSend = inputFiles
		inputFiles = new DataTransfer().files // Clear chat files after submission
		inputText = ""
		sendMessage(textToSend, filesToSend)
	}

	const submitOnEnter = (event: KeyboardEvent) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault()
			submitPrompt()
		}
	}

	// Use button for file input, for styling
	let fileInput: HTMLInputElement
	const triggerFileInput = () => {
		fileInput.click()
	}
</script>

<div>
	<FileDropZone onFilesDropped={(files) => { inputFiles = files; }} />
  <form onsubmit={(event: Event) => { event.preventDefault(); submitPrompt() }}>
    <GrowingTextArea bind:value={inputText} placeholder="Type your message here..." onkeydown={submitOnEnter} />
    <div id="actions">
      <div id="actions-left">
        <div id="chat-file-upload-container">
					{#if allowedMessageMimeTypes.length === 0}
						<span>Filopplasting er ikke mulig her</span>
					{:else}
						<button onclick={triggerFileInput}>Legg til filer</button>
          	<input bind:files={inputFiles} bind:this={fileInput} type="file" id="chat-file-upload" multiple accept={allowedMessageMimeTypes.join(",")} />
						{#if inputFiles.length > 0}
          		<button type="reset" onclick={() => { inputFiles = new DataTransfer().files; }}>Clear Files ({inputFiles.length})</button>
						{/if}
					{/if}
          <!--{JSON.stringify(allowedMessageMimeTypes)}-->
        </div>
      </div>
      <div id="actions-right">
        <button type="submit">Send</button>
      </div>
    </div>
  </form>
</div>

<style>
  #actions {
    display: flex;
    justify-content: space-between;
  }
	#chat-file-upload {
		display: none;
	}
</style>