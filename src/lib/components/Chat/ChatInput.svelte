<script lang="ts">
	import FileDropZone from "../FileDropZone.svelte"

	type Props = {
		allowedFileMimeTypes: string[]
		sendMessage: (inputText: string, inputFiles: FileList) => Promise<void>
	}
	let { allowedFileMimeTypes, sendMessage }: Props = $props()

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

<div>
	<FileDropZone onFilesDropped={(files) => { inputFiles = files; }} />
  <form onsubmit={(event: Event) => { event.preventDefault(); submitPrompt() }}>
    <div class="grow-wrap" bind:this={wrapDiv}>
      <textarea rows="1" bind:this={textArea} placeholder="Skriv et eller annet (shift + enter for ny linje)" name="prompt-input" id="prompt-input" oninput={sneakyTextArea} onkeydown={submitOnEnter} bind:value={inputText}></textarea>
    </div>
    <div id="actions">
      <div id="actions-left">
        <div id="chat-file-upload-container">
					{#if allowedFileMimeTypes.length === 0}
						<span>Filopplasting er ikke mulig her</span>
					{:else}
						<span>Last opp filer til chat:</span>
          	<input bind:files={inputFiles} type="file" id="chat-file-upload" multiple accept={allowedFileMimeTypes.join(",")} />
						{#if inputFiles.length > 0}
          		<button type="reset" onclick={() => { inputFiles = new DataTransfer().files; }}>Clear Files ({inputFiles.length})</button>
						{/if}
					{/if}
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