<script lang="ts">
	import FileDropZone from "../FileDropZone.svelte"
	import GrowingTextArea from "../GrowingTextArea.svelte"
	import TypingDots from "../TypingDots.svelte"
	import type { ChatState } from "./ChatState.svelte"

	type Props = {
		chatState: ChatState
		sendMessage: (inputText: string, inputFiles: FileList) => Promise<void>
	}
	let { chatState, sendMessage }: Props = $props()

	// Determine allowed file mime types based on model/vendor
	let allowedMessageMimeTypes = $derived.by(() => {
		if (!chatState.chat.config.model) {
			return []
		}

		const vendor = chatState.APP_CONFIG.VENDORS[chatState.chat.config.vendorId]
		if (!vendor) {
			return []
		}
		const supportedTypes = vendor.MODELS.find((model) => model.ID === chatState.chat.config.model)?.SUPPORTED_MESSAGE_FILE_MIME_TYPES

		if (!supportedTypes) {
			return []
		}
		return [...supportedTypes.FILE, ...supportedTypes.IMAGE]
	})

	// Internal state for this component
	let inputText: string = $state("")
	let inputFiles = $state(new DataTransfer().files)
	let messageInProgress = $state(false)

	// Simple helper for posting prompt, and clearing input
	const submitPrompt = async (): Promise<void> => {
		if (messageInProgress || (inputText.trim() === "" && inputFiles.length === 0)) {
			return // Do not submit empty prompts or if a message is already in progress
		}
		const textToSend = inputText
		const filesToSend = inputFiles
		inputFiles = new DataTransfer().files // Clear chat files after submission
		inputText = ""
		messageInProgress = true
		await sendMessage(textToSend, filesToSend)
		messageInProgress = false
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

	// Funksjone for å håndtere copy-paste
	const handlePaste = (event: ClipboardEvent) => {
		const clipBoardItems = event.clipboardData?.items
		if (!clipBoardItems) return
		
		const filerPaste: File[] = []

		for (const fil of clipBoardItems) {
			if (fil.kind === "file") {
				const filObjekt = fil.getAsFile()
				if (filObjekt) {
					filerPaste.push(filObjekt)
				}
			}
		}

		if (filerPaste.length === 0) return

		const dataTransfer = new DataTransfer()

		// Legg til filer fra clipboard
		for (const fil of filerPaste) {
			dataTransfer.items.add(fil)
		}
		inputFiles = dataTransfer.files
	}
</script>

<div class="chat-input-container">
	<FileDropZone onFilesDropped={(files) => { inputFiles = files; }} />
  <form onsubmit={(event: Event) => { event.preventDefault(); submitPrompt() }}>
    <GrowingTextArea bind:value={inputText} placeholder="Type your message here..." onkeydown={submitOnEnter} onpaste={handlePaste}/>
    <div id="actions">
      <div id="actions-left">
        <div id="chat-file-upload-container">
					{#if allowedMessageMimeTypes.length === 0}
						<span>Filopplasting er ikke mulig her</span>
					{:else}
						<button class="icon-button" onclick={triggerFileInput} title="Legg til filer">
							<span class="material-symbols-outlined">
								attach_file
							</span>
							Legg ved
						</button>
          	<input bind:files={inputFiles} bind:this={fileInput} type="file" id="chat-file-upload" multiple accept={allowedMessageMimeTypes.join(",")} />
						{#if inputFiles.length > 0}
          		<button type="reset" onclick={() => { inputFiles = new DataTransfer().files; }}>Clear Files ({inputFiles.length})</button>
						{/if}
					{/if}
          <!--{JSON.stringify(allowedMessageMimeTypes)}-->
        </div>
      </div>
      <div id="actions-right">
				{#if messageInProgress}
					<button disabled class="filled" title="Melding pågår...">
						<TypingDots />
					</button>
				{:else}
					<button disabled={inputText.trim().length === 0 && inputFiles.length === 0} class="filled" type="submit" title={inputText.trim().length === 0 && inputFiles.length === 0 ? "Skriv en melding eller legg til filer for å sende" : "Send melding"}>
						<span class="material-symbols-outlined">
							send
						</span>
						Send
					</button>
				{/if}
      </div>
    </div>
  </form>
</div>

<style>
	.chat-input-container {
		padding-top: 0.3rem;
	}
  #actions {
		padding-top: 0.2rem;
    display: flex;
    justify-content: space-between;
  }
	#chat-file-upload {
		display: none;
	}
</style>