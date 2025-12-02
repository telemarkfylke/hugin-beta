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
			if (event.dataTransfer?.types.includes('Files')) {
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

		document.addEventListener('dragenter', handleDragEnter)
		document.addEventListener('dragleave', handleDragLeave)
		document.addEventListener('dragover', handleDragOver)
		document.addEventListener('drop', handleDrop)

		//Rydde i event listeners når drop zone unmounte, hvis ikke blir de liggende
		return () => {
			document.removeEventListener('dragenter', handleDragEnter)
			document.removeEventListener('dragleave', handleDragLeave)
			document.removeEventListener('dragover', handleDragOver)
			document.removeEventListener('drop', handleDrop)
		}
	})
</script>

{#if showDropZone}
	<div class="file-drop-zone-overlay">
		<div class="file-drop-zone-content">
			<h2>Last opp filer</h2>
			<p>Støtter ymse formater...</p>
		</div>
	</div>
{/if}

<style>
	.file-drop-zone-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 9999;
		background-color: black;
		opacity: 0.8;
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.file-drop-zone-content {
		background-color: white;
		border: 1px solid black;
		padding: 20px;
		border-radius: 16px;
		text-align: center;
		color: black;
	}

	.file-drop-zone-content h2 {
		font-size: 20px;
	}

	.file-drop-zone-content p {
		font-size: 12px;
	}
</style>
