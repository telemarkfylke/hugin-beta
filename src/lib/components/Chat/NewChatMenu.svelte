<script lang="ts">
	import type { ChatHistory } from "$lib/types/chat"
	import type { ChatState } from "./ChatState.svelte"

	type MenuState = "closed" | "open" | "filename"

	type RavenFile = { meta: { fileversion: number }; history: ChatHistory }

	type Props = {
		chatState: ChatState
		onNewChat: () => void
		exportDisabled: boolean
	}

	let { chatState = $bindable(), onNewChat, exportDisabled }: Props = $props()

	let menuState: MenuState = $state("closed")

	// Nothing to show in the dropdown at all if file import/export is turned off for this org and
	// this user can't have history stored either - then it's just a plain "Ny samtale" button.
	let hasMenuOptions = $derived(!exportDisabled || chatState.canUseHistory)

	let fileInput: HTMLInputElement

	let filename = $state("")
	let container: HTMLDivElement
	let saving = $state(false)
	let saveError: string | null = $state(null)

	function handleOutsideClick(event: MouseEvent) {
		if (menuState !== "closed" && !container.contains(event.target as Node)) {
			menuState = "closed"
		}
	}

	function triggerFileSelect() {
		fileInput.click()
	}

	function toggleMenu() {
		menuState = menuState === "closed" ? "open" : "closed"
	}

	async function handleFileSelect(event: Event) {
		menuState = "closed"
		const input = event.target as HTMLInputElement
		if (input.files && input.files.length > 0) {
			const selectedFile = input.files[0]
			if (selectedFile) {
				const conversationJson = await selectedFile?.text()
				if (conversationJson) {
					const fileContent: RavenFile = JSON.parse(conversationJson) as RavenFile
					chatState.importHistory(fileContent.history)
					const fileParts = selectedFile.name.split(".")
					if (fileParts.length > 1) {
						fileParts.pop()
					}
					filename = fileParts.join(".")
				}
			}
		}
		input.value = ""
	}

	const openSave = async () => {
		menuState = "filename"
	}

	const saveConversation = async () => {
		menuState = "closed"

		const ravenFile: RavenFile = { meta: { fileversion: 1 }, history: chatState.chat.history }
		const content = JSON.stringify(ravenFile)

		const blob = new Blob([content], { type: "text/plain" })
		const url = URL.createObjectURL(blob)

		const a = document.createElement("a")
		a.href = url
		a.download = `${filename}.kráa`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	// For a conversation with history but no conversationId - an import, or one that has been
	// incognito since its very first message - there is otherwise no way to turn it into a real,
	// stored conversation. This bulk-persists the whole thing as a new one.
	const handleSaveAsNew = async (event: MouseEvent) => {
		event.stopPropagation()
		menuState = "closed"
		saving = true
		saveError = null
		try {
			await chatState.saveCurrentAsNewConversation()
		} catch (error) {
			console.error("Error saving conversation as new:", error)
			saveError = "Kunne ikke lagre samtalen som ny samtale."
		} finally {
			saving = false
		}
	}
</script>

<svelte:document onclick={handleOutsideClick} />

<div class="splitbutton" bind:this={container}>
	<input
		id="hidden-file-input"
		type="file"
		bind:this={fileInput}
		onchange={handleFileSelect}
		style="display: none"
		accept=".kráa"
	/>
	<button class="header-action" onclick={onNewChat} title="Ny samtale">
		<span class="material-symbols-rounded">edit_square</span>
		Ny samtale
	</button>
	{#if hasMenuOptions}
		<button class="icon-button caret" onclick={toggleMenu} title="Flere valg">
			<span class="material-symbols-rounded">expand_more</span>
		</button>
	{/if}
	{#if menuState === "open"}
		<div class="splitmenu">
			{#if !exportDisabled}
				<button onclick={(e) => { e.stopPropagation(); triggerFileSelect() }}>
					<span class="material-symbols-rounded">upload</span>Import
				</button>
				<button onclick={(e) => { e.stopPropagation(); openSave() }}>
					<span class="material-symbols-rounded">download</span>Eksport
				</button>
			{/if}
			{#if chatState.canUseHistory}
				<button disabled={saving || chatState.chat.history.length === 0} onclick={handleSaveAsNew}>
					<span class="material-symbols-rounded">save</span>{saving ? "Lagrer…" : "Lagre gjeldende samtale"}
				</button>
			{/if}
		</div>
	{:else if menuState === "filename"}
		<div class="splitmenu filename-form">
			<label for="filename_input">Gi samtalen et navn</label>
			<input id="filename_input" type="text" bind:value={filename} placeholder="Navn..." />
			<div class="filename-actions">
				<button onclick={() => menuState = "closed"}>Avbryt</button>
				<button class="filled" onclick={saveConversation}>Lagre</button>
			</div>
		</div>
	{/if}
</div>
{#if saveError}
	<span class="save-error">{saveError}</span>
{/if}

<style>
	.splitbutton {
		position: relative;
		display: inline-flex;
	}
	.caret {
		border-left: 1px solid var(--color-primary-20);
		border-radius: 0 6px 6px 0;
	}
	.splitmenu {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
		background: white;
		border: 1px solid var(--color-primary-30);
		border-radius: 8px;
		z-index: 10;
		min-width: 14rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}
	.splitmenu button {
		display: flex;
		white-space: nowrap;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		border: none;
		border-radius: 0;
		background: none;
		padding: 0.6rem 1rem;
		text-align: left;
		color: var(--color-primary);
	}
	.splitmenu button:hover:not(:disabled) {
		background-color: var(--color-primary-10);
	}
	.splitmenu button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.save-error {
		display: inline-block;
		margin-left: 0.5rem;
		color: var(--color-danger);
		font-size: smaller;
	}
	.filename-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
	}
	.filename-form input[type="text"] {
		font: inherit;
		font-size: small;
		padding: 0.5rem;
		background-color: #f7f7f7;
		border: none;
		border-radius: 4px;
		width: 100%;
		box-sizing: border-box;
	}
	.filename-form label {
		color: var(--color-primary);
		font-size: small;
	}
	.filename-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
</style>
