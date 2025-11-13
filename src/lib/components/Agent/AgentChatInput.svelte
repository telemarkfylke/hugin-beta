<script lang="ts">
  // Get bindable prompt (dont use $bindable often) and state modifying functions from props
  let { prompt = $bindable(), filesForUpload = $bindable(), postUserPrompt } = $props();

  // Internal state
  let files = $state(new DataTransfer().files)

  // Some element references
  let inputForm: HTMLFormElement;
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
      postUserPrompt();
    }
  };
</script>

<div>
  <form bind:this={inputForm} onsubmit={(event: Event) => { event.preventDefault(); postUserPrompt() }}>
    <div class="grow-wrap" bind:this={wrapDiv}>
      <textarea rows="1" bind:this={textArea} name="prompt-input" id="prompt-input" oninput={sneakyTextArea} onkeydown={submitOnEnter} bind:value={prompt}></textarea>
    </div>
    <div id="actions">
      <div id="actions-left">
        <input bind:files type="file" id="file-upload" multiple />
        {#if files.length > 0}
          <button type="button" onclick={() => { console.log('laster opp filer') }}>Last opp ({files.length})</button>
          <button type="reset" onclick={() => { files = new DataTransfer().files; }}>Clear Files ({files.length})</button>
        {/if}
      </div>
      <div id="actions-right">
        <button type="submit">Send</button>
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
  .grow-wrap::after, #prompt-input {
    max-height: 8rem;
  }
  .grow-wrap {
    /* easy way to plop the elements on top of each other and have them both sized based on the tallest one's height */
    display: grid;
    border: 2px solid salmon; /* Just to visualize the grow-wrap area for debugging */
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