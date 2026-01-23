<script lang="ts">
	import FileDropZone from "../FileDropZone.svelte"
	import FilePreviewRow from "../FilePreviewRow.svelte"
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

	// Handle paste events for clipboard images
	const handlePaste = (event: ClipboardEvent) => {
		const items = event.clipboardData?.items
		if (!items) return

		const imageFiles: File[] = []

		for (const item of Array.from(items)) {
			if (item.kind === "file" && item.type.startsWith("image/")) {
				// Check if this image type is allowed
				if (allowedMessageMimeTypes.includes(item.type)) {
					const file = item.getAsFile()
					if (file) {
						imageFiles.push(file)
					}
				}
			}
		}

		if (imageFiles.length > 0) {
			event.preventDefault() // Prevent default paste behavior for images

			// Merge with existing files
			const dataTransfer = new DataTransfer()
			for (const file of Array.from(inputFiles)) {
				dataTransfer.items.add(file)
			}
			for (const file of imageFiles) {
				dataTransfer.items.add(file)
			}
			inputFiles = dataTransfer.files
		}
	}

	// Handle files from drop zone
	const handleFilesDropped = (files: FileList) => {
		// Merge with existing files
		const dataTransfer = new DataTransfer()
		for (const file of Array.from(inputFiles)) {
			dataTransfer.items.add(file)
		}
		for (const file of Array.from(files)) {
			// Only add if mime type is allowed
			if (allowedMessageMimeTypes.includes(file.type)) {
				dataTransfer.items.add(file)
			}
		}
		inputFiles = dataTransfer.files
	}

	// Remove a file by index
	const removeFile = (index: number) => {
		const dataTransfer = new DataTransfer()
		const filesArray = Array.from(inputFiles)
		filesArray.splice(index, 1)
		for (const file of filesArray) {
			dataTransfer.items.add(file)
		}
		inputFiles = dataTransfer.files
	}

	// Use button for file input, for styling
	let fileInput: HTMLInputElement
	const triggerFileInput = () => {
		fileInput.click()
	}

	// Handle file input change
	const handleFileInputChange = (event: Event) => {
		const target = event.target as HTMLInputElement
		if (target.files && target.files.length > 0) {
			handleFilesDropped(target.files)
			// Reset input so the same file can be selected again
			target.value = ""
		}
	}
</script>

<div class="chat-input-container">
	<FileDropZone onFilesDropped={handleFilesDropped} />

	<div class="input-wrapper">
		{#if inputFiles.length > 0}
			<FilePreviewRow files={inputFiles} onRemove={removeFile} />
		{/if}

		<form onsubmit={(event) => { event.preventDefault(); submitPrompt() }}>
			<div class="input-row">
				{#if allowedMessageMimeTypes.length > 0}
					<button
						type="button"
						class="icon-button attach-btn"
						onclick={triggerFileInput}
						title="Legg til filer"
						aria-label="Legg til filer"
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

				<div class="textarea-container">
					<GrowingTextArea
						bind:value={inputText}
						placeholder="Skriv meldingen din her..."
						onkeydown={submitOnEnter}
						onpaste={handlePaste}
					/>
				</div>

				<button
					class="send-btn filled"
					type="submit"
					disabled={messageInProgress || (inputText.trim() === "" && inputFiles.length === 0)}
					title={messageInProgress ? "Sender melding..." : inputText.trim() === "" && inputFiles.length === 0 ? "Skriv en melding eller legg til filer" : "Send melding"}
					aria-label="Send melding"
				>
					{#if messageInProgress}
						<TypingDots />
					{:else}
						<span class="material-symbols-outlined">arrow_upward</span>
					{/if}
				</button>
			</div>
		</form>
	</div>

	{#if allowedMessageMimeTypes.length === 0}
		<p class="no-upload-hint">Filopplasting er ikke tilgjengelig for denne modellen</p>
	{/if}
</div>

<style>
	.chat-input-container {
		padding: var(--spacing-sm) 0;
	}

	.input-wrapper {
		background-color: var(--color-bg-secondary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-xl);
		overflow: hidden;
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.input-wrapper:focus-within {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px var(--color-accent-light);
	}

	form {
		padding: var(--spacing-xs);
	}

	.input-row {
		display: flex;
		align-items: flex-end;
		gap: var(--spacing-xs);
	}

	.attach-btn,
	.send-btn {
		flex-shrink: 0;
		width: 2.25rem;
		height: 2.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: var(--spacing-xs);
		padding: 0;
	}

	.attach-btn {
		border-radius: var(--radius-md);
	}

	.send-btn {
		border-radius: var(--radius-full);
	}

	.send-btn span {
		font-size: var(--font-size-xl);
	}

	.textarea-container {
		flex: 1;
		min-width: 0;
	}

	.no-upload-hint {
		font-size: var(--font-size-xs);
		color: var(--color-text-tertiary);
		text-align: center;
		margin: var(--spacing-xs) 0 0 0;
	}
</style>
