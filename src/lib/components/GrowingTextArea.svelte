<script lang="ts">
	type Props = {
		value?: string | undefined
		initialRows?: number
		placeholder?: string
		onkeydown?: (event: KeyboardEvent) => void
		id?: string
	}

	let { value = $bindable(), initialRows = 1, placeholder = "", onkeydown = (): void => {}, id = "growing-textarea" }: Props = $props()

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
		value // Track changes to inputText
		wrapDiv.setAttribute("data-replicated-value", textArea.value) // Update replicated value on change
	})
</script>

<div class="grow-wrap" bind:this={wrapDiv}>
  <textarea rows={initialRows} bind:this={textArea} placeholder={placeholder} name="prompt-input" id={id} onkeydown={onkeydown} bind:value={value}></textarea>
</div>

<style>
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