<script lang="ts">
  // Get state modifying functions from props
  let { postUserPrompt, addKnowledgeFilesToConversation } = $props();

  // Internal state for this component
  let userPrompt = $state('');
  let files = $state(new DataTransfer().files)

  // Simple helper for posting prompt, and clearing input
  const submitPrompt = () => {
    postUserPrompt(userPrompt);
    userPrompt = '';
  };

  const submitFiles = () => {
    if (files.length > 0) {
      addKnowledgeFilesToConversation(files);
      files = new DataTransfer().files; // Clear files after submission
    }
  };

  // Some element references
  let textArea: HTMLTextAreaElement;
  let wrapDiv: HTMLDivElement;
  /**
   * As we wait for "textarea {field-sizing: content;}" to be supported in all browsers
   * Magic is in CSS below, this JS just updates the data attribute on input
   * Thank you to Chris Coyier and Stephen Shaw
   * @link https://chriscoyier.net/2023/09/29/css-solves-auto-expanding-textareas-probably-eventually/
   */
  const sneakyTextArea = () => {
    wrapDiv.setAttribute('data-replicated-value', textArea.value);
  };
  const submitOnEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitPrompt();
    }
  };
</script>

<div>
  <form onsubmit={(event: Event) => { event.preventDefault(); submitPrompt() }}>
    <div class="grow-wrap input-with-send" bind:this={wrapDiv}>
      <textarea rows="1" bind:this={textArea} placeholder="Skriv et eller annet (shift + enter for ny linje)" name="prompt-input" id="prompt-input" oninput={sneakyTextArea} onkeydown={submitOnEnter} bind:value={userPrompt}></textarea>
      <button class="snd-btn-in-input" type="submit" title="Send">⇧</button>
    </div>
    <div id="actions">
      <div id="actions-left">
        <!-- WHOOOPS bruk dynamisk accept basert på agenten, og enable disable fileupload basert på agenten (https://platform.openai.com/docs/assistants/tools/file-search#supported-files), MISTRAL: PNG, JPEG, JPG, WEBP, GIF, PDF, DOCX, PPTX, EPUB, CSV, TXT, MD, XLSX --> 
        <input   bind:files type="file" id="file-upload" multiple accept=".png,.jpeg,.jpg,.webp,.gif,.pdf,.docx,.pptx,.epub,.csv,.txt,.md,.xlsx,image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/epub+zip,text/csv,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
        {#if files.length > 0}
          <button type="button" class="fils-btn"  onclick={submitFiles}>Last opp ({files.length})</button>
          <button type="reset" class="fils-btn" onclick={() => { files = new DataTransfer().files; }}>Clear Files ({files.length})</button>
        {/if}
      </div>
    </div>
  </form>
  {files.length}
</div>

<style>
  #actions {
    display: flex;
    justify-content: space-between;
  }

  /* START AUTO GROW TEXTAREA STYLES */
  .grow-wrap::after,#prompt-input {
    max-height: 8rem;
    border-radius: 15px;
    height: 40px;
    width: 70%;
    margin-left: auto;
    margin-right: auto;
    display: block;
    box-shadow:
    0 2px 4px rgba(44, 44, 44, 0.25),
    0 4px 10px rgba(44, 44, 44, 0.35);
    margin-bottom: 30px;
  }


  .fils-btn {
    margin-top: 10px;
    margin-right: 10px;
    padding: 8px 12px;
    background-color: #B2CBCF;
    color: #333;
    border: 1px solid #ccc;
    border-radius: 5px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(44, 44, 44, 0.25);
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  input[type="file"]::file-selector-button {
    padding: 8px 12px;
    background-color: #B2CBCF;
    color: #333;
    margin-left: 80px;
    border: 1px solid #ccc;
    border-radius: 5px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    margin-right: 10px;
    box-shadow: 0 2px 4px rgba(44, 44, 44, 0.25);
    transition: background 0.15s ease, border-color 0.15s ease;
}

input[type="file"]::file-selector-button:hover {
        background: #CCDCDF;
    border-color: #666;
}

  .input-with-send {
    position: relative;
    display: grid;
    align-items: center;
  }

  .snd-btn-in-input {
    position: absolute;
    right: 15%;
    top: 35%;
    transform: translateY(-54%);
    height: 40px;
    width: 40px;
    padding: 0 12px;
    background-color: #B2CBCF;
    color: #333;
    border: 1px solid #555;
    border-radius: 5px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    z-index: 2;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .snd-btn-in-input:hover {
    background: #CCDCDF;
    border-color: #666;
  }

  .input-with-send textarea {
    padding-right: 4rem; /* Gi plass til Send-knappen */
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