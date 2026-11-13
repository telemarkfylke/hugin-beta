import type { AttachmentRef } from "$lib/conversationattachments/types"

export type InputText = {
	type: "input_text"
	text: string
}

// A stored message holds `ref` and an empty fileUrl/imageUrl instead of the data URL - the file
// itself is in S3 and is loaded back on the server. The empty string (not a missing field) is
// deliberate: code that predates refs (e.g. an older deploy on the same database) then still
// gets a string and degrades to "file not available" instead of crashing.
export type InputFile = {
	type: "input_file"
	fileName: string
	fileUrl: string
	ref?: AttachmentRef
}

export type InputImage = {
	type: "input_image"
	imageUrl: string
	ref?: AttachmentRef
}

export type UrlCitation = {
	type: "url_citation"
	url: string
	title: string
	startIndex?: number | undefined // Fordi Mistral har indexer på siteringer
	endIndex?: number | undefined
}

export type OutputText = {
	type: "output_text"
	text: string
	annotations?: UrlCitation[]
}

export type OutputRefusal = {
	type: "output_refusal"
	reason: string
}

export type ChatItemContent = InputText | InputFile | InputImage | OutputText | OutputRefusal
