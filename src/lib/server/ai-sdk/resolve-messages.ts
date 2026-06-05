import type { FilePart, ImagePart, ModelMessage, TextPart } from "ai"
import type { ChatInputItem } from "$lib/types/chat-item"
import type { InputFile, InputImage, InputText, OutputText } from "$lib/types/chat-item-content"

const inputTextToPart = (content: InputText): TextPart => ({ type: "text", text: content.text })

const inputImageToPart = (content: InputImage): ImagePart => ({ type: "image", image: content.imageUrl })

const inputFileToPart = (content: InputFile): FilePart => {
	const mimeType = content.fileUrl.substring(
		content.fileUrl.indexOf(":") + 1,
		content.fileUrl.indexOf(";base64")
	)
	return {
		type: "file",
		data: content.fileUrl,
		mediaType: mimeType
	}
}

const outputTextToPart = (content: OutputText): TextPart => ({ type: "text", text: content.text })

export const resolveMessages = (inputs: ChatInputItem[]): ModelMessage[] => {
	const messages: ModelMessage[] = []

	for (const item of inputs) {
		if (item.type === "message.input") {
			const parts = item.content.map((c) => {
				switch (c.type) {
					case "input_text":
						return inputTextToPart(c)
					case "input_image":
						return inputImageToPart(c)
					case "input_file":
						return inputFileToPart(c)
				}
			})
			messages.push({ role: "user", content: parts })
		} else if (item.type === "message.output") {
			const parts = item.content
				.filter((c): c is OutputText => c.type === "output_text")
				.map((c) => outputTextToPart(c))
			messages.push({ role: "assistant", content: parts })
		}
	}

	return messages
}
