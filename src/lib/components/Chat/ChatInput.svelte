<script lang="ts">
	import type { ChatConfig } from "$lib/types/chat"
	import { VENDOR_SUPPORTED_MESSAGE_MIME_TYPES } from "$lib/vendor-constants"
	import FileDropZone from "../FileDropZone.svelte"

	
	let isMenuOpen = $state(false);
	
	
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
	const submitPrompt = async (): Promise<void> => {
		if (inputText.trim() === "" && inputFiles.length === 0) {
			return // Do not submit empty prompts
		}
		const textToSend = inputText
		const filesToSend = inputFiles
		inputFiles = new DataTransfer().files // Clear chat files after submission
		inputText = ""
		await sendMessage(textToSend, filesToSend)
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

<div class="content" class:sidebar-open={isMenuOpen}>
	<FileDropZone onFilesDropped={(files) => { inputFiles = files; }} />
  <form onsubmit={(event: Event) => { event.preventDefault(); submitPrompt() }}>
    <div class="grow-wrap" bind:this={wrapDiv}>
      <textarea rows="1" bind:this={textArea} placeholder="Skriv et eller annet (shift + enter for ny linje)" name="prompt-input" id="prompt-input" oninput={sneakyTextArea} onkeydown={submitOnEnter} bind:value={inputText} ></textarea>
    </div>
    <div id="actions">
      <div id="actions-left">
        <div id="chat-file-upload-container">
					{#if allowedMessageMimeTypes.length === 0}
						<span>Filopplasting er ikke mulig her</span>
					{:else}
          	<input class="file-btn" bind:files={inputFiles} type="file" id="chat-file-upload"  />
						{#if inputFiles.length > 0}
          		<button  type="reset" onclick={() => { inputFiles = new DataTransfer().files; }}>Clear Files ({inputFiles.length})</button>
						{/if}
					{/if}
 
        </div>
      </div>
      <div id="actions-right">
        <button class="submit-btn" title="Send inn " type="submit">↑</button>
      </div>
    </div>
  </form>
</div>

<style>
  #actions {
    display: flex;
    justify-content: space-between;
  }

  .file-btn  {
	position: fixed;
	right: 59%;
    bottom: 8px;
    cursor: pointer;
    z-index: 20;
	transition: right 0.3s ease, background 0.3s, box-shadow 0.3s;
	margin-left: 0;

  }
  	.content {
		margin-left: 0;
		transition: margin-left 0.3s ease;
	}
	
	.content.sidebar-open {
		margin-left: 220px;
	}

  .file-btn::file-selector-button {
	background: #80A8AF;
	color: white;
	border: none;
	border-radius: 4px;
	padding: 6px 12px;
	cursor: pointer;
	transition: background 0.3s, box-shadow 0.3s;
  }

  .file-btn::file-selector-button:hover {
	background: #196370;
	box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2);
  }
  /* START AUTO GROW TEXTAREA STYLES */
  .grow-wrap::after, #prompt-input {
	position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
	width: 45%;
	display: block;
	border-radius: 8px;
	border-style: solid 1px #333;
	box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.1);
    transform: translateX(-50%);
    transition: left 0.3s ease, transform 0.3s ease;

	
  }

  .submit-btn {
	position: fixed;
    right: 27.3%;
	font-size: 14px;
	margin-bottom: 58px;
    bottom: 8px;
    background: #80A8AF;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    z-index: 20;
		transition: right 0.3s ease, background 0.3s, box-shadow 0.3s;
	margin-left: 0;
	
  }

  .submit-btn:hover {
	background: #196370;
	box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2);
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

  /* Når sidebar er åpen */
:global(body.sidebar-open) .grow-wrap::after, 
:global(body.sidebar-open) #prompt-input {
  left: calc(50% + 110px); /* Flytt mot høyre */
}

/* Samme for knappene */
:global(body.sidebar-open) .submit-btn {
  right: calc(27.3% - 110px);
}

:global(body.sidebar-open) .file-btn {
  right: calc(59% - 110px);
}
  /* END AUTO GROW TEXTAREA STYLES */
</style>