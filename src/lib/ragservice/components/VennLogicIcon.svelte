<script lang="ts">
	type Props = {
		mode: "and" | "or"
	}
	let { mode }: Props = $props()
</script>

<svg class="venn" class:mode-and={mode === "and"} class:mode-or={mode === "or"} viewBox="0 0 32 20" aria-hidden="true" focusable="false">
	<circle class="venn-a" cx="11" cy="10" r="7" />
	<circle class="venn-b" cx="21" cy="10" r="7" />
</svg>

<style>
	svg.venn {
		width: 46px;
		height: 28px;
		overflow: visible;
	}

	/* A visible stroke on both circles, independent of fill-opacity below, so the two circles
	   read as circles (not a solid blob) regardless of mode - the previous version overlapped
	   them almost completely with no outline, which just looked like a filled pill. */
	svg.venn .venn-a,
	svg.venn .venn-b {
		fill: var(--color-primary);
		stroke: var(--color-primary);
		stroke-width: 1.25;
	}

	/* And = only the overlap (both conditions true) reads as "the answer" - two low-opacity
	   circles multiplied together naturally darken just where they overlap. */
	svg.venn.mode-and .venn-a,
	svg.venn.mode-and .venn-b {
		fill-opacity: 0.45;
		mix-blend-mode: multiply;
	}

	/* Or = the whole union reads as "the answer" - solid fill, no special overlap emphasis. */
	svg.venn.mode-or .venn-a,
	svg.venn.mode-or .venn-b {
		fill-opacity: 0.7;
	}
</style>
