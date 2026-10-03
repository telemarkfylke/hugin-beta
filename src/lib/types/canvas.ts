export type CanvasRequest = {
	document: string
	prompt: string
	webSearch?: boolean
}

export type PresentationRequest = {
	slides: string
	prompt: string
	webSearch?: boolean
	document?: {
		fileName: string
		fileUrl: string
	}
}

export type PresentationExportRequest = {
	slides: string
}
