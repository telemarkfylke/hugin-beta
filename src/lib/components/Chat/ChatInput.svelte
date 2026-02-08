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

	// La den her, men  den burde kanskje ligge i en config et sted?
	const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB er 10 * 1024 * 1024 bytes :-)

	// Internal state for this component
	let inputText: string = $state("")
	let inputFiles: File[] = $state([])
	let messageInProgress = $state(false)
	let fileSizeWarning = $state(false)

	// Konverter filarrayen til en liste med filer
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
		const oversizedFiles: string[] = []
		const validFiles = files.filter((file) => {
			if (allowedMessageMimeTypes.length === 0) {
				return false
			}
			if (!allowedMessageMimeTypes.includes(file.type)) {
				return false
			}
			if (file.size > MAX_FILE_SIZE_BYTES) {
				oversizedFiles.push(file.name)
				return false
			}
			return true
		})
		if (oversizedFiles.length > 0) {
			fileSizeWarning = true
			setTimeout(() => {
				fileSizeWarning = false
			}, 4000) // Viser varsel i 4 sekunder
		}
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

	// Some element references
	let textArea: HTMLTextAreaElement
	let wrapDiv: HTMLDivElement
	/**
	 * As we wait for "textarea {field-sizing: content;}" to be supported in all browsers
	 * Magic is in CSS below, this JS just updates the data attribute on input
	 * Thank you to Chris Coyier and Stephen Shaw
	 * @link https://chriscoyier.net/2023/09/29/css-solves-auto-expanding-textareas-probably-eventually/
	 */
	$effect(() => {
		inputText // Track changes to inputText
		if (wrapDiv && textArea) {
			wrapDiv.setAttribute("data-replicated-value", textArea.value)
		}
	})
</script>

<div class="chat-input-container">
	<FileDropZone onFilesDropped={handleFilesDropped} />

	<!-- Main input wrapper -->
	<div class="input-wrapper">
		{#if inputFiles.length > 0}
			<div class="file-previews">
				{#each inputFiles as file, index}
					<FilePreview {file} onRemove={() => removeFile(index)} />
				{/each}
			</div>
		{/if}

		{#if fileSizeWarning}
			<div class="file-size-warning">Filen er for stor (maks 10 MB)</div>
		{/if}

		<div class="input-row">
			<div class="input-text">
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
			</div>
			<div class="input-submit">
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
</div>

<style>
	.chat-input-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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

	/* File previews container */
	.file-previews {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem 0rem;
	}

	.file-size-warning {
		font-size: 0.85rem;
		color: var(--color-danger);
		padding: 0.25rem 0;
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
	}

	.input-text {
		flex: 1;
		min-width: 100%;
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
		padding: 0.5rem 0;
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

	/* If large enough screen, make input row horizontal */
	@media (min-width: 40rem) {
		.input-text {
			min-width: auto;
		}
		.input-actions {
			order: -1;
		}
	}

</style>
