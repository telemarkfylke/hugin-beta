<script lang="ts">
	type Props = {
		file: File
		onRemove: (file: File) => void
	}

	let { file, onRemove }: Props = $props()

	// Først sjekker vi om filen er et bilde
	let isImage = $derived(file.type.startsWith("image/"))

	// Hvis det er et bilde, lager vi en URL for forhåndsvisning
	let imageUrl = $derived(isImage ? URL.createObjectURL(file) : "")

	// Fjern forhåndsvisningen når komponenten fjernes
	$effect(() => {
		return () => {
			if (isImage) {
				URL.revokeObjectURL(imageUrl)
			}
		}
	})

	// Returner passende ikon basert på MIME-typen
	const getFileIcon = (mimeType: string): string => {
		if (mimeType === "application/pdf") return "picture_as_pdf"
		if (mimeType.startsWith("text/")) return "description"
		if (mimeType.includes("word")) return "description"
		if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "table_chart"
		return "attach_file"
	}
</script>

<div class="file-preview">
	<button class="remove-button filled" onclick={() => onRemove(file)} title="Fjern fil">
		<span class="material-symbols-outlined">close</span>
	</button>

	<div class="file-preview-content">
		{#if isImage}
			<img src={imageUrl} alt={file.name} class="preview-image" />
		{:else}
			<span class="file-icon material-symbols-outlined">{getFileIcon(file.type)}</span>
		{/if}
	</div>

	<span class="file-name" title={file.name}>{file.name}</span>
</div>

<style>
	.file-preview {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 0.25rem 0;
		width: 5rem;
		height: 4.5rem;
		background-color: var(--color-primary-10);
		border: 1px solid var(--color-primary-30);
		border-radius: 6px;
	}

	.file-preview-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.25rem;
		overflow: hidden;
	}

	.preview-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.file-icon {
		font-size: 2rem;
		color: var(--color-primary);
	}

	.file-name {
		font-size: 0.7rem;
		text-align: center;
		max-width: 80%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.remove-button {
		position: absolute;
		top: -0.5rem;
		right: -0.5rem;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		cursor: pointer;
		justify-content: center;
	}

	.remove-button .material-symbols-outlined {
		font-size: 1rem;
	}
</style>