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
	<button class="remove-button" onclick={onRemove} title="Fjern fil">
		<span class="material-symbols-outlined">close</span>
	</button>

	{#if isImage}
		<img src={imageUrl} alt={file.name} class="preview-image" />
	{:else}
		<div class="file-icon">
			<span class="material-symbols-outlined">{getFileIcon(file.type)}</span>
		</div>
	{/if}

	<span class="file-name" title={file.name}>{file.name}</span>
</div>

<style>
	.file-preview {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 5rem;
		padding: 0.5rem;
		background-color: var(--color-primary-10);
		border-radius: 0.5rem;
		border: 1px solid var(--color-primary-20);
	}

	.remove-button {
		position: absolute;
		top: -0.5rem;
		right: -0.5rem;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border-radius: 50%;
		background-color: var(--color-primary);
		color: white;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.remove-button:hover {
		background-color: var(--color-primary-80);
	}

	.remove-button .material-symbols-outlined {
		font-size: 1rem;
	}

	.preview-image {
		width: 4rem;
		height: 4rem;
		object-fit: cover;
		border-radius: 0.25rem;
	}

	.file-icon {
		width: 4rem;
		height: 4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--color-primary-20);
		border-radius: 0.25rem;
	}

	.file-icon .material-symbols-outlined {
		font-size: 2rem;
		color: var(--color-primary);
	}

	.file-name {
		margin-top: 0.25rem;
		font-size: 0.7rem;
		color: var(--color-primary);
		text-align: center;
		width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>