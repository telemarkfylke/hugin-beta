import type { InputText, InputFile, InputImage, OutputRefusal, OutputText } from "./chat-item-content"

export type ChatInputMessageContent = InputText | InputFile | InputImage

export type ChatInputMessage = {
	type: "message.input"
	role: "user" | "developer" | "system"
	content: Array<ChatInputMessageContent>
}

export type ChatOutputMessageContent = OutputText | OutputRefusal

export type ChatOutputMessage = {
	id: string
	type: "message.output"
	role: "assistant"
	content: Array<ChatOutputMessageContent>
}

export type ChatInputItem = ChatInputMessage | ChatOutputMessage

export type ChatOutputItem = ChatOutputMessage

export type ChatItem = ChatInputItem | ChatOutputItem