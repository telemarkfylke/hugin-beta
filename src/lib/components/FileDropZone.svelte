<script lang="ts">
	type Props = {
		onFilesDropped: (files: FileList) => void
	}

	let { onFilesDropped }: Props = $props()

	let showDropZone = $state(false)

	$effect(() => {
		//DragEvent API: https://developer.mozilla.org/en-US/docs/Web/API/DragEvent
		// Bare støtte for filer nå
		const handleDragEnter = (event: DragEvent) => {
			if (event.dataTransfer?.types.includes("Files")) {
				showDropZone = true
			}
		}

		const handleDragLeave = (event: DragEvent) => {
			if (!event.relatedTarget) {
				showDropZone = false
			}
		}

		const handleDragOver = (event: DragEvent) => {
			event.preventDefault()
		}

		const handleDrop = (event: DragEvent) => {
			event.preventDefault()
			showDropZone = false

			const files = event.dataTransfer?.files
			if (files && files.length > 0) {
				onFilesDropped(files)
			}
		}

		document.addEventListener("dragenter", handleDragEnter)
		document.addEventListener("dragleave", handleDragLeave)
		document.addEventListener("dragover", handleDragOver)
		document.addEventListener("drop", handleDrop)

		//Rydde i event listeners når drop zone unmounte, hvis ikke blir de liggende
		return () => {
			document.removeEventListener("dragenter", handleDragEnter)
			document.removeEventListener("dragleave", handleDragLeave)
			document.removeEventListener("dragover", handleDragOver)
			document.removeEventListener("drop", handleDrop)
		}
	})
</script>

{#if showDropZone}
	<div class="file-drop-zone-overlay">
		<div class="file-drop-zone-content">
			<span class="material-symbols-outlined drop-icon">upload_file</span>
			<h2>Last opp filer</h2>
			<p>Slipp filene dine her</p>
		</div>
	</div>
{/if}

<style>
	.file-drop-zone-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background-color: var(--color-overlay-bg);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.file-drop-zone-content {
		background-color: var(--color-overlay-content-bg);
		border: 2px dashed var(--color-accent);
		padding: var(--spacing-xl);
		border-radius: var(--radius-xl);
		text-align: center;
	}

	.drop-icon {
		font-size: 3rem;
		color: var(--color-accent);
		margin-bottom: var(--spacing-sm);
	}

	.file-drop-zone-content h2 {
		color: var(--color-accent);
		margin: 0 0 var(--spacing-xs) 0;
		font-size: var(--font-size-xl);
	}

	.file-drop-zone-content p {
		color: var(--color-text-secondary);
		margin: 0;
		font-size: var(--font-size-sm);
	}
</style>
