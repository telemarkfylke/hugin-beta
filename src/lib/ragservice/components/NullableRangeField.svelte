<script lang="ts">
	import "./ragservice-shared.css"
	import InfoTooltip from "./InfoTooltip.svelte"

	type Props = {
		label: string
		min: number
		max: number
		step?: number
		decimals?: number
		value: number | null
		help?: string
	}
	let { label, min, max, step = 1, decimals = 0, value = $bindable(), help }: Props = $props()

	let localValue = $state(value ?? min)

	function toggle(checked: boolean) {
		value = checked ? localValue : null
	}

	function onSlide(v: number) {
		localValue = v
		value = v
	}
</script>

<div class="rag-field">
	<label class="rag-field-label">
		<input type="checkbox" checked={value != null} onchange={(e) => toggle(e.currentTarget.checked)} />
		{label}
		{#if help}<InfoTooltip text={help} />{/if}
	</label>
	<input
		type="range"
		{min}
		{max}
		{step}
		disabled={value == null}
		value={value ?? localValue}
		oninput={(e) => onSlide(Number(e.currentTarget.value))}
	/>
	<span class="rag-field-value">{value != null ? value.toFixed(decimals) : "–"}</span>
</div>
