<script lang="ts">
	import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"
	import { onMount } from "svelte"

	// Excalidraw is a React component. It is mounted into a plain <div> with react-dom, and everything
	// (React, Excalidraw, its CSS) is imported dynamically in onMount - so it never runs during SSR and the
	// multi-MB bundle is only downloaded on pages that actually use it.
	type Props = {
		onReady: (api: ExcalidrawImperativeAPI) => void
	}

	let { onReady }: Props = $props()

	let container: HTMLDivElement
	let loadError = $state("")

	onMount(() => {
		let unmount: (() => void) | undefined
		let cancelled = false

		const mount = async () => {
			// Serve fonts from Hugin itself (static/excalidraw-assets, copied by scripts/copy-excalidraw-assets.mjs);
			// Excalidraw only falls back to its CDN if these fail. Must be set before Excalidraw loads.
			;(window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/"
			const [{ createElement }, { createRoot }, { Excalidraw }] = await Promise.all([
				import("react"),
				import("react-dom/client"),
				import("@excalidraw/excalidraw"),
				import("@excalidraw/excalidraw/index.css")
			])
			if (cancelled) return
			const root = createRoot(container)
			root.render(createElement(Excalidraw, { excalidrawAPI: onReady, langCode: "nb-NO" }))
			unmount = () => root.unmount()
		}

		mount().catch((e: unknown) => {
			loadError = e instanceof Error ? e.message : "Kunne ikke laste Excalidraw"
		})

		return () => {
			cancelled = true
			unmount?.()
		}
	})
</script>

{#if loadError}
	<p class="load-error">{loadError}</p>
{/if}
<div class="excalidraw-host" bind:this={container}></div>

<style>
	.excalidraw-host {
		width: 100%;
		height: 100%;
		min-height: 400px;
	}

	.load-error {
		color: var(--color-danger);
	}
</style>
