<script lang="ts">
	import { onDestroy } from "svelte"

	type Props = {
		files: FileList
		onRemove: (index: number) => void
	}

	let { files, onRemove }: Props = $props()

	// Track object URLs for cleanup
	let objectUrls: string[] = []

	// Generate preview URL for an image file
	const getPreviewUrl = (file: File): string | null => {
		if (file.type.startsWith("image/")) {
			const url = URL.createObjectURL(file)
			objectUrls.push(url)
			return url
		}
		return null
	}

	// Get appropriate icon for file type
	const getFileIcon = (file: File): string => {
		if (file.type === "application/pdf") return "picture_as_pdf"
		if (file.type.startsWith("image/")) return "image"
		if (file.type.includes("word") || file.type.includes("document")) return "description"
		if (file.type.includes("sheet") || file.type.includes("excel") || file.type.includes("csv")) return "table_chart"
		if (file.type.includes("presentation") || file.type.includes("powerpoint")) return "slideshow"
		return "description"
	}

	// Format file size for display
	const formatFileSize = (bytes: number): string => {
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	}

	// Cleanup object URLs when files change or component destroys
	$effect(() => {
		// Access files to track changes (side effect triggers on files.length change)
		void files.length

		// Cleanup previous URLs
		return () => {
			for (const url of objectUrls) {
				URL.revokeObjectURL(url)
			}
			objectUrls = []
		}
	})

	onDestroy(() => {
		for (const url of objectUrls) {
			URL.revokeObjectURL(url)
		}
	})
</script>

<div class="file-preview-row">
	{#each Array.from(files) as file, index}
		<div class="file-preview-item">
			{#if file.type.startsWith("image/")}
				<img src={getPreviewUrl(file)} alt={file.name} class="preview-thumbnail" />
			{:else}
				<div class="file-icon-container">
					<span class="material-symbols-outlined">{getFileIcon(file)}</span>
				</div>
			{/if}

			<button
				type="button"
				class="remove-btn"
				onclick={() => onRemove(index)}
				title="Fjern fil"
				aria-label="Fjern {file.name}"
			>
				<span class="material-symbols-outlined">close</span>
			</button>

			<div class="file-info">
				<span class="file-name" title={file.name}>{file.name}</span>
				<span class="file-size">{formatFileSize(file.size)}</span>
			</div>
		</div>
	{/each}
</div>

<style>
	.file-preview-row {
		display: flex;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		overflow-x: auto;
		max-width: 100%;
		border-bottom: 1px solid var(--color-border-primary);
	}

	.file-preview-item {
		position: relative;
		flex-shrink: 0;
		width: 5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.preview-thumbnail {
		width: 4rem;
		height: 4rem;
		object-fit: cover;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-primary);
		background-color: var(--color-bg-secondary);
	}

	.file-icon-container {
		width: 4rem;
		height: 4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--color-bg-tertiary);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-primary);
	}

	.file-icon-container span {
		font-size: 1.5rem;
		color: var(--color-text-secondary);
	}

	.remove-btn {
		position: absolute;
		top: -0.375rem;
		right: 0.125rem;
		width: 1.25rem;
		height: 1.25rem;
		padding: 0;
		border-radius: var(--radius-full);
		background-color: var(--color-bg-primary);
		border: 1px solid var(--color-border-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transition: opacity var(--transition-fast), background-color var(--transition-fast);
		box-shadow: var(--shadow-sm);
	}

	.file-preview-item:hover .remove-btn {
		opacity: 1;
	}

	.remove-btn:hover {
		background-color: var(--color-bg-hover);
	}

	.remove-btn span {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.file-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		max-width: 100%;
	}

	.file-name {
		font-size: var(--font-size-xs);
		color: var(--color-text-primary);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}

	.file-size {
		font-size: 0.625rem;
		color: var(--color-text-tertiary);
	}
</style>
