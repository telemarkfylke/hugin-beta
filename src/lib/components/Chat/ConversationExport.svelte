<script lang="ts">
	import type { Chat, ChatHistory } from "$lib/types/chat"

	type MenuState = "closed" | "open" | "filename"

	type RavenFile = { meta: { fileversion: number }; history: ChatHistory }

	let menuState: MenuState = $state("closed")

	type Props = {
		chat: Chat
	}

	let { chat = $bindable() }: Props = $props()

	let fileInput: HTMLInputElement

	let filename = $state("")
	let container: HTMLDivElement

	function handleOutsideClick(event: MouseEvent) {
		if (menuState !== "closed" && !container.contains(event.target as Node)) {
			menuState = "closed"
		}
	}

	function triggerFileSelect() {
		fileInput.click()
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
					chat.history = fileContent.history
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

		const ravenFile: RavenFile = { meta: { fileversion: 1 }, history: chat.history }
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
	<button
		onclick={() => {
			if(menuState === "closed")
					menuState = "open"
			else{
					menuState = "closed"
			}
		}}
		class="header-action"
		title="Import/Eksport"><span class="material-symbols-rounded">import_export</span> Import/Eksport</button
	>
	{#if menuState === "open"}
		<div class="splitmenu">
			<button onclick={(e) => { e.stopPropagation(); triggerFileSelect() }}>
				<span class="material-symbols-rounded">upload</span>Import
			</button>
			<button onclick={(e) => { e.stopPropagation(); openSave() }}>
				<span class="material-symbols-rounded">download</span>Eksport
			</button>
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

<style>
	.splitbutton {
		position: relative;
		display: inline-block;
	}
	.splitmenu {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
		background: white;
		border: 1px solid var(--color-primary-30);
		border-radius: 8px;
		z-index: 10;
		min-width: 10rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}
	.splitmenu button {
		display: flex;
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
	.splitmenu button:hover {
		background-color: var(--color-primary-10);
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
