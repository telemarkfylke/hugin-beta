import type { AgentPrompt } from "$lib/types/message"

export const getUserInputTextFromPrompt = (prompt: AgentPrompt): string | null => {
	if (typeof prompt === "string") {
		return prompt
	}
	const firstPromptWithText = prompt.find((promptInput) => promptInput.role === "user" && promptInput.input.some((input) => input.type === "text"))
	if (!firstPromptWithText) {
		return null
	}
	const textInput = firstPromptWithText.input.find((input) => input.type === "text")
	if (textInput && textInput.type === "text") {
		return textInput.text
	}
	return null
}
