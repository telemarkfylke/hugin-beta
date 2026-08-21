<script lang="ts">
	import type { LayoutProps } from "./$types"

	let { children }: LayoutProps = $props()
</script>

<div class="canvas-shell">
	<div class="canvas-shell-body">
		{@render children()}
	</div>
</div>

<style>
	.canvas-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background-color: #f0f0ef;
	}

	.canvas-shell-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
	}
</style>
