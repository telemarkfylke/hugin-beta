<script lang="ts">
	import type { Chat } from "$lib/types/chat"

	type MenuState = "closed" | "open" | "filename"

	let menuState: MenuState = $state("closed")

	type Props = {
		chat: Chat
	}

	let { chat = $bindable() }: Props = $props()

	let fileInput: HTMLInputElement

	let filename = $state("")

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
					chat.history = JSON.parse(conversationJson)
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
		const content = JSON.stringify(chat.history)
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

<div class="splitbutton">
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
		class="icon-button">Import/Export</button
	>
	{#if menuState==="open"}
		<div class="splitmenu">
			<button class="icon-button" onclick={triggerFileSelect}>
				Import
			</button>
			<button onclick={openSave}>
				Export
			</button>
		</div>
	{:else if menuState==="filename"}
	<div class="splitmenu">
		<label for="filename_input">Gi samtalen et navn</label>
		<input id="filename_input" type="text" bind:value={filename} placeholder="Navn..." />
		<button onclick={saveConversation}>
			Lagre
		</button>
	</div>

	{/if}
</div>

<style>
  .splitbutton {
    position: relative;
    display: inline-block;
  }

.splitmenu {
    position:absolute;
    top: 100%;
    left: 0;
    background: white;
    border: 1px solid #ddd;
    z-index: 10;
    min-width: 120px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  }
  .splitmenu button {
    display: block;
    width: 100%;
    background: none;
    border: none;
    padding: 8px 16px;
    text-align: left;
    cursor: pointer;
  }
  .splitmenu button:hover {
    background: #f0f0f0;
  }


	input[type="text"] {
		width: calc(100% - 0.5rem);
		font-family: var(--font-family);
		font-size: inherit;
		padding: 0.25rem;
	}

	label {
		color: var(--color-primary);
		font-size: small;
		display: inline-block;
		padding-bottom: 0.5rem;
	}

</style>
