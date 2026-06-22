<script lang="ts">
	import { page } from "$app/state";
	import type { StoreState } from "$lib/ragservice/types";
  import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi";

	const api = new RagServiceApi()

let files: FileList | null = $state(null);
let fileInput: HTMLInputElement;

type Props = {
	onFileUploaded: (data: string) => void
	};

let { onFileUploaded }: Props = $props();

const handleUpload = async () => {
	// Prevent default form submission if using a form element
	// e.preventDefault(); 

	if(fileInput.files){
		addVectorStoreFiles(storeState, fileInput.files)
	}

	
	/*
	const formData = new FormData();
	// Append the selected file to the FormData object
	formData.append("image", files[0]);

	// Send the data to your API endpoint
	const req = await fetch("/api/image-upload", {
		method: "POST",
		body: formData,
	});

	const res = await req.json();
	console.log(res);
	*/
};


const storeId: string = $derived(page.params.storeId) as string
const storeState: StoreState = $state({
	storeId: storeId,
	vectorStoreFiles: [],
	isLoading: false
})

export async function addVectorStoreFiles(storeState: StoreState, files: FileList): Promise<void> {
if (!files || files.length === 0) {
	throw new Error("No files provided for upload")
}
if (!storeState.storeId) {
	throw new Error("storeId are required to upload files to a conversation")
}
const formData = new FormData()
formData.append("stream", "true") // assuming we want always want streaming in frontend
for (let i = 0; i < files.length; i++) {
	formData.append("files[]", files[i] as File)
}

const response = await api.uploadFile(storeState.storeId, formData)
onFileUploaded("Behandler..")
if(!response) return

/*
const response = await fetch(`http://localhost:7071/api/stores/${storeState.storeId}/files`, {
	method: "POST",
	body: formData
})
*/
if (!response.ok) {
	throw new Error(`HTTP error! status: ${response.status}`)
}
if (!response.body) {
	throw new Error("Response body is null")
}
try {
	const reader = response.body.getReader()
	const decoder = new TextDecoder("utf-8")
	while (true) {
		const { value, done } = await reader.read()
		const chatResponseText = decoder.decode(value, { stream: true })
		const uploadResponse =  chatResponseText
		for (const uploadResult of uploadResponse) {
			console.log(uploadResult)
/*				
			switch (uploadResult.event) {
				case "conversation.vectorstore.file.uploaded": {
					const { fileId, fileName } = uploadResult.data
					console.log(`File uploaded: ${fileName} (ID: ${fileId})`)
					const vectorStoreFile: VectorStoreFile = {
						id: fileId,
						name: fileName,
						type: "unknown", // Type and size are unknown at this point, need to return it somehow from backend
						bytes: 0, // Size is unknown at this point, need to return it somehow from backend
						summary: null,
						status: "processing"
					}
					_addConversationVectorStoreFileToState(agentState, vectorStoreFile)
					break
				}
				case "conversation.vectorstore.files.processed": {
					const { files } = uploadResult.data
					console.log("Files processed:", files.map((file) => file.fileId).join(", "))
					for (const file of files) {
						_updateConversationVectorStoreFileStatusInState(agentState, file.fileId, "ready")
					}
					break
				}
				default:
					console.warn("Unhandled upload result event:", uploadResult)
					break
			}
*/						
		}
		if (done){
			onFileUploaded("Done")
		} break
	}
} catch (error) {
	console.error("Error uploading files to conversation vector store:", error)
	storeState.error = (error as Error).message
}
}


</script>
<!--AgentConversationVectorStoreFiles storeState={storeState} dataTransfer={dataTransfer} /-->
<main>
<form on:submit|preventDefault={handleUpload}>
	<div>
	<label for="file-to-upload">Velg fil </label>
<!-- 
	Use bind:files to bind the Svelte variable to the input's files property.
	Use bind:this to get a reference to the DOM element if needed (optional here).
-->

<input
	id="file-to-upload"
	type="file"
	bind:files
	bind:this={fileInput}
/></div>
<button type="submit" class="button">Last opp</button>
</form>
</main>

<style>
	button {
		margin: 4px;
	}
</style>

