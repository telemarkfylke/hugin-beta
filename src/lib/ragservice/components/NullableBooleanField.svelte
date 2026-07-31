<script lang="ts">
	import "./ragservice-shared.css"
	import InfoTooltip from "./InfoTooltip.svelte"

	type Props = {
		label: string
		value: boolean | null
		help?: string
	}
	let { label, value = $bindable(), help }: Props = $props()

	function onChange(raw: string) {
		value = raw === "" ? null : raw === "true"
	}
</script>

<div class="rag-simple-field">
	<span class="rag-field-label">{label}{#if help}<InfoTooltip text={help} />{/if}</span>
	<select value={value == null ? "" : String(value)} onchange={(e) => onChange(e.currentTarget.value)}>
		<option value="">Ikke satt</option>
		<option value="true">Ja</option>
		<option value="false">Nei</option>
	</select>
</div>
