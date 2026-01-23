<script lang="ts">
	import FileDropZone from "../FileDropZone.svelte"
	import TypingDots from "../TypingDots.svelte"
	import FilePreview from "./FilePreview.svelte"
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
	let inputFiles: File[] = $state([])
	let messageInProgress = $state(false)
	let textArea: HTMLTextAreaElement

	// KOnverter filarrayen til en liste med filer
	const filesToFileList = (files: File[]): FileList => {
		const dataTransfer = new DataTransfer()
		for ( const file of files ) {
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
		const validFiles = files.filter(file => {
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

	<!-- File previews above input -->
	{#if inputFiles.length > 0}
		<div class="file-previews">
			{#each inputFiles as file, index}
				<FilePreview {file} onRemove={() => removeFile(index)} />
			{/each}
		</div>
	{/if}

	<!-- Main input wrapper -->
	<div class="input-wrapper">
		<!-- Attachment button (left) -->
		{#if allowedMessageMimeTypes.length > 0}
			<button
				class="input-action-button"
				onclick={triggerFileInput}
				title="Legg til filer"
				type="button"
			>
				<span class="material-symbols-outlined">add</span>
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

		<!-- Send button (right) -->
		{#if messageInProgress}
			<button class="input-action-button sending" disabled title="Sender...">
				<TypingDots />
			</button>
		{:else}
			<button
				class="input-action-button send"
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
		padding: 0.5rem;
		background-color: var(--color-primary-10);
		border-radius: 0.75rem 0.75rem 0 0;
		border: 1px solid var(--color-primary-20);
		border-bottom: none;
	}

	/* Main input wrapper - the rounded container */
	.input-wrapper {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		padding: 0.5rem;
		background-color: white;
		border: 1px solid var(--color-primary);
		border-radius: 1.5rem;
		transition: border-color 0.2s;
	}

	.input-wrapper:focus-within {
		border-color: var(--color-primary-80);
		box-shadow: 0 0 0 2px var(--color-primary-20);
	}

	/* When file previews are shown, adjust border radius */
	.file-previews + .input-wrapper {
		border-radius: 0 0 1.5rem 1.5rem;
		border-top: none;
	}

	/* Action buttons inside input */
	.input-action-button {
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 50%;
		background-color: var(--color-primary-10);
		color: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.input-action-button:hover:not(:disabled) {
		background-color: var(--color-primary-20);
	}

	.input-action-button:disabled {
		background-color: var(--color-primary-10);
		color: var(--color-primary-30);
		cursor: not-allowed;
	}

	.input-action-button.send:not(:disabled) {
		background-color: var(--color-primary);
		color: white;
	}

	.input-action-button.send:hover:not(:disabled) {
		background-color: var(--color-primary-80);
	}

	.input-action-button .material-symbols-outlined {
		font-size: 1.25rem;
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
		padding: 0.5rem 0;
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
</style>
