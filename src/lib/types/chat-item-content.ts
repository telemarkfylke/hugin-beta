export type InputText = {
	type: "input_text"
	text: string
}

export type InputFile = {
	type: "input_file"
	fileName: string
	fileUrl: string
}

export type InputImage = {
	type: "input_image"
	imageUrl: string
}

export type UrlCitation = {
	type: "url_citation"
	url: string
	title: string
	startIndex: number
	endIndex: number
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
