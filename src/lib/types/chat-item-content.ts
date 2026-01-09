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

export type OutputText = {
	type: "output_text"
	text: string
}

export type OutputRefusal = {
	type: "output_refusal"
	reason: string
}

export type ChatItemContent = InputText | InputFile | InputImage | OutputText | OutputRefusal
