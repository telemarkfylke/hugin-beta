<script lang="ts">
	import FileDropZone from "../FileDropZone.svelte"
	import TypingDots from "../TypingDots.svelte"
	import type { ChatState } from "./ChatState.svelte"
	import FilePreview from "./FilePreview.svelte"

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
	let inputFiles: File[] = $state([])
	let messageInProgress = $state(false)
	let textArea: HTMLTextAreaElement

	// KOnverter filarrayen til en liste med filer
	const filesToFileList = (files: File[]): FileList => {
		const dataTransfer = new DataTransfer()
		for (const file of files) {
			dataTransfer.items.add(file)
		}
		return dataTransfer.files
	}

	// Simple helper for posting prompt, and clearing input
	const submitPrompt = async (): Promise<void> => {
		if (messageInProgress || (inputText.trim() === "" && inputFiles.length === 0)) {
			return // Do not submit empty prompts or if a message is already in progress
		}
		const textToSend = inputText
		const filesToSend = filesToFileList(inputFiles)
		inputFiles = [] // Clear chat files after submission
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

	// Når noen klikker på "legg ved filer" knappen
	let fileInput: HTMLInputElement
	const triggerFileInput = () => {
		fileInput.click()
	}

	// Håndtering av filinput endring
	const handleFileInputChange = (event: Event) => {
		const target = event.target as HTMLInputElement
		if (target.files) {
			addFiles(Array.from(target.files))
		}
		// Reset input so same file can be selected again
		target.value = ""
	}

	const addFiles = (files: File[]) => {
		const validFiles = files.filter((file) => {
			if (allowedMessageMimeTypes.length === 0) {
				return false
			} else {
				return allowedMessageMimeTypes.includes(file.type)
			}
		})
		inputFiles = [...inputFiles, ...validFiles]
	}

	// Håndtering av drag-n-drop filer
	const handleFilesDropped = (files: FileList) => {
		addFiles(Array.from(files))
	}

	// Fjerning av filer
	const removeFile = (index: number) => {
		inputFiles = inputFiles.filter((_, i) => i !== index)
	}

	// Handle copy-pasta fra clipboard
	const handlePaste = (event: ClipboardEvent) => {
		const items = event.clipboardData?.items
		if (!items) return

		const files: File[] = []
		for (const item of Array.from(items)) {
			if (item.kind === "file") {
				const file = item.getAsFile()
				if (file) {
					files.push(file)
				}
			}
		}

		if (files.length > 0) {
			event.preventDefault()
			addFiles(files)
		}
	}

	// Autoresize textarea
	let wrapDiv: HTMLDivElement
	$effect(() => {
		inputText
		if (wrapDiv && textArea) {
			wrapDiv.setAttribute("data-replicated-value", textArea.value)
		}
	})
</script>

<div class="chat-input-container">
	<FileDropZone onFilesDropped={handleFilesDropped} />

	<!-- Main input wrapper -->
	<div class="input-wrapper">
		<!-- File previews above input -->
		{#if inputFiles.length > 0}
			<div class="file-previews">
				{#each inputFiles as file, index}
					<FilePreview {file} onRemove={() => removeFile(index)} />
				{/each}
			</div>
		{/if}

		<!-- Text input -->
		<div class="grow-wrap" bind:this={wrapDiv}>
			<textarea
				bind:this={textArea}
				bind:value={inputText}
				placeholder="Skriv en melding..."
				onkeydown={submitOnEnter}
				onpaste={handlePaste}
				rows={1}
			></textarea>
		</div>

		<div class="input-actions">
			<!-- Attachment button (left) -->
			{#if allowedMessageMimeTypes.length > 0}
				<button
					class="icon-button input-action-button"
					onclick={triggerFileInput}
					title="Legg til filer"
					type="button"
				>
					<span class="material-symbols-outlined">attach_file</span>
				</button>
				<input
					bind:this={fileInput}
					type="file"
					multiple
					accept={allowedMessageMimeTypes.join(",")}
					onchange={handleFileInputChange}
					hidden
				/>
			{/if}

			<!-- Send button (right) -->
			{#if messageInProgress}
				<button class="icon-button input-action-button send" disabled title="Sender...">
					<TypingDots />
				</button>
			{:else}
				<button
					class="icon-button filled input-action-button send"
					onclick={submitPrompt}
					disabled={inputText.trim().length === 0 && inputFiles.length === 0}
					title={inputText.trim().length === 0 && inputFiles.length === 0
						? "Skriv en melding eller legg til filer for å sende"
						: "Send melding"}
					type="button"
				>
					<span class="material-symbols-outlined">arrow_upward</span>
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.chat-input-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* File previews container */
	.file-previews {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 1rem 0rem;
	}

	/* Main input wrapper - the rounded container */
	.input-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-primary);
		border-radius: 24px;
		transition: border-color 0.2s;
	}

	.input-wrapper:focus-within {
		border-color: var(--color-primary-80);
		box-shadow: 0 0 0 2px var(--color-primary-20);
	}

	.input-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	/* Action buttons inside input */
	.input-action-button {
		padding: 0.5rem 0.375rem; /* To keep consistent with input-textarea spacing */
	}

	.input-action-button.send {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		transition: background-color 0.2s;
		justify-content: center;
	}

	/* Auto-growing textarea styles */
	.grow-wrap {
		flex: 1;
		display: grid;
	}

	.grow-wrap::after {
		content: attr(data-replicated-value) " ";
		white-space: pre-wrap;
		visibility: hidden;
		max-height: 8rem;
	}

	.grow-wrap > textarea,
	.grow-wrap::after {
		font: inherit;
		padding: 0.5rem 0.375rem;
		grid-area: 1 / 1 / 2 / 2;
		border: none;
		outline: none;
		resize: none;
		background: transparent;
		max-height: 8rem;
		overflow-y: auto;
	}

	.grow-wrap > textarea::placeholder {
		color: var(--color-primary-70);
	}
	/* END Auto-growing textarea styles */
</style>
