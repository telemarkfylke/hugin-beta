<script lang="ts">
	import { themeState } from "$lib/stores/theme.svelte"
</script>

<button
	class="theme-toggle icon-button"
	onclick={themeState.toggle}
	title={themeState.current === "light" ? "Bytt til mørk modus" : "Bytt til lys modus"}
	aria-label={themeState.current === "light" ? "Bytt til mørk modus" : "Bytt til lys modus"}
>
	<span class="material-symbols-rounded">
		{themeState.current === "light" ? "dark_mode" : "light_mode"}
	</span>
</button>

<style>
	.theme-toggle {
		transition: transform var(--transition-fast);
	}
	.theme-toggle:hover {
		transform: rotate(15deg);
	}
</style>
