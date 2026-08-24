<script lang="ts">
	import type { Snippet } from "svelte"
	import "./ragservice-shared.css"
	import InfoTooltip from "./InfoTooltip.svelte"

	type Props = {
		value: "and" | "or"
		help?: string
		// Tints the row so it reads as belonging to whatever surrounds it (see
		// DataStoreTextSearch, where this sits between the two thresholds it combines).
		highlight?: boolean
		// Rendered after the info icon, in normal flow - "Logikk" itself stays first so it lines
		// up with sibling labels like "Text Threshold"/"Vector Threshold".
		icon?: Snippet
		// The choice is moot unless both thresholds it combines are actually active - callers pass
		// this rather than the field disabling itself, since it has no way to know about them.
		disabled?: boolean
	}
	let { value = $bindable(), help, highlight = false, icon, disabled = false }: Props = $props()

	const groupName = $props.id()
</script>

<div class="rag-simple-field" class:highlight class:disabled>
	<span class="rag-field-label">
		<!-- Invisible, same control as NullableRangeField's real checkbox - not padding guessed
		     to match its width, so "Logikk" lines up with "Text Threshold"/"Vector Threshold"
		     exactly regardless of how big the browser actually renders a checkbox. -->
		<input class="alignment-spacer" type="checkbox" disabled tabindex="-1" aria-hidden="true" />
		Logikk
		{#if help}<InfoTooltip text={help} />{/if}
		{#if icon}{@render icon()}{/if}
	</span>
	<div class="rag-radio-group">
		<label class="rag-radio">
			<input type="radio" name={groupName} value="and" bind:group={value} {disabled} />
			And
		</label>
		<label class="rag-radio">
			<input type="radio" name={groupName} value="or" bind:group={value} {disabled} />
			Or
		</label>
		{#if disabled}
			<!-- Not a native title: those are slow to appear and unreliable over disabled form
			     controls in some browsers (see InfoTooltip, same issue there). Plain CSS :hover
			     on the group works regardless of the inputs' disabled state, since :hover only
			     cares about pointer position, not interactivity. -->
			<span class="disabled-reason" role="tooltip">Aktiver begge tersklene for å velge logikk</span>
		{/if}
	</div>
</div>

<style>
	input.alignment-spacer {
		visibility: hidden;
	}
</style>
