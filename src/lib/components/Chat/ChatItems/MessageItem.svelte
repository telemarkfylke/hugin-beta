<script lang="ts">
	import { markdownFormatter } from "$lib/formatting/markdown-formatter.js"
	import type { ChatItem } from "$lib/types/chat-item"

	type Props = {
		chatItem: ChatItem
	}
	let { chatItem }: Props = $props()

	// Copy functionality state
	let copySuccess = $state(false)

	// Copy message content to clipboard
	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text)
			copySuccess = true
			setTimeout(() => {
				copySuccess = false
			}, 2000)
		} catch (err) {
			console.error("Failed to copy:", err)
		}
	}

	// Extract plain text from message content for copying
	const getMessageText = (content: Array<{ type: string; text?: string; reason?: string }>): string => {
		return content
			.filter((part) => part.type === "output_text" || part.type === "output_refusal")
			.map((part) => (part.type === "output_text" ? part.text : part.reason))
			.filter(Boolean)
			.join("\n\n")
	}

	// Helper
	const getImage = (imageUrl: string): string => {
		if (imageUrl.startsWith("data:")) {
			return imageUrl
		} else {
			// Placeholder image for non-data URLs
			return `data:image/png;base64,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`
		}
	}

	const fileplaceholderImage =
		"data:image/png;base64,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"
</script>

{#if chatItem.type === "message.input"}
	<div class="user-message">
		{#each chatItem.content as contentPart}
			<div class="user-message-part user-message-part-{contentPart.type}">
				{#if contentPart.type === "input_text"}
					{contentPart.text}
				{:else if contentPart.type === "input_image"}
					<img src={getImage(contentPart.imageUrl)} alt="Opplastet bilde" class="message-image" />
				{:else if contentPart.type === "input_file"}
					<div class="file-attachment">
						<img src={fileplaceholderImage} alt="Fil" class="file-icon" />
						<span class="file-name">{contentPart.fileName}</span>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{:else if chatItem.type === "message.output"}
	<div class="assistant-message">
		<div class="message-content">
			{#each chatItem.content as contentPart}
				<div class="assistant-message-part assistant-message-part-{contentPart.type}">
					{#if contentPart.type === "output_text"}
						{@html markdownFormatter(contentPart.text)}
					{:else if contentPart.type === "output_refusal"}
						<em class="refusal">Assistenten nektet å svare: {contentPart.reason}</em>
					{:else}
						<span class="unknown-content">Ukjent innholdstype</span>
						{JSON.stringify(contentPart)}
					{/if}
				</div>
			{/each}
		</div>

		<div class="message-actions">
			<button
				class="icon-button copy-btn"
				onclick={() => copyToClipboard(getMessageText(chatItem.content))}
				title={copySuccess ? "Kopiert!" : "Kopier melding"}
				aria-label={copySuccess ? "Kopiert!" : "Kopier melding"}
			>
				<span class="material-symbols-outlined">
					{copySuccess ? "check" : "content_copy"}
				</span>
			</button>
		</div>
	</div>
{/if}

<style>
	.user-message {
		align-self: flex-end;
		background-color: var(--color-msg-user-bg);
		color: var(--color-msg-user-text);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-lg);
		max-width: 80%;
		overflow-wrap: break-word;
		word-break: break-word;
	}

	.user-message-part {
		margin-bottom: var(--spacing-xs);
	}

	.user-message-part:last-child {
		margin-bottom: 0;
	}

	.message-image {
		max-width: 200px;
		max-height: 200px;
		border-radius: var(--radius-md);
		display: block;
		margin-top: var(--spacing-xs);
	}

	.file-attachment {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-xs) var(--spacing-sm);
		background-color: var(--color-bg-tertiary);
		border-radius: var(--radius-md);
		margin-top: var(--spacing-xs);
	}

	.file-icon {
		width: 2rem;
		height: 2rem;
		object-fit: contain;
	}

	.file-name {
		font-size: var(--font-size-sm);
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 150px;
	}

	.assistant-message {
		align-self: flex-start;
		max-width: 100%;
		position: relative;
	}

	.message-content {
		color: var(--color-msg-assistant-text);
		line-height: 1.6;
	}

	.assistant-message-part {
		margin-bottom: var(--spacing-sm);
	}

	.assistant-message-part:last-child {
		margin-bottom: 0;
	}

	.refusal {
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.unknown-content {
		color: var(--color-text-tertiary);
		font-size: var(--font-size-sm);
	}

	.message-actions {
		display: flex;
		gap: var(--spacing-xs);
		margin-top: var(--spacing-xs);
		opacity: 0;
		transition: opacity var(--transition-fast);
	}

	.assistant-message:hover .message-actions {
		opacity: 1;
	}

	.copy-btn {
		padding: var(--spacing-xs);
		border-radius: var(--radius-sm);
		height: auto;
		width: auto;
	}

	.copy-btn span {
		font-size: var(--font-size-base);
		color: var(--color-text-secondary);
	}

	.copy-btn:hover span {
		color: var(--color-text-primary);
	}
</style>
