<script lang="ts">
	type Props = {
		label: string
		min: number
		max: number
		step?: number
		decimals?: number
		value: number | null
	}
	let { label, min, max, step = 1, decimals = 0, value = $bindable() }: Props = $props()

	let localValue = $state(value ?? min)

	function toggle(checked: boolean) {
		value = checked ? localValue : null
	}

	function onSlide(v: number) {
		localValue = v
		value = v
	}
</script>

<tr>
	<td>
		<label><input type="checkbox" checked={value != null} onchange={(e) => toggle(e.currentTarget.checked)} /> {label}</label>
	</td>
	<td>{value != null ? value.toFixed(decimals) : "–"}</td>
	<td>
		<input
			type="range"
			{min}
			{max}
			{step}
			disabled={value == null}
			value={value ?? localValue}
			oninput={(e) => onSlide(Number(e.currentTarget.value))}
		/>
	</td>
</tr>
