import type { ChatConfig } from "$lib/types/chat"

export const saveChatConfig = async (config: ChatConfig): Promise<ChatConfig> => {
	const result = await fetch("/api/chatconfigs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(config)
	})
	if (!result.ok) {
		const errorData = await result.json().catch(() => null)
		throw new Error(`${result.status}: ${errorData?.message ?? result.statusText}`)
	}
	return result.json() as Promise<ChatConfig>
}

export const updateChatConfig = async (config: ChatConfig): Promise<ChatConfig> => {
	const result = await fetch(`/api/chatconfigs/${config._id}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(config)
	})
	if (!result.ok) {
		const errorData = await result.json().catch(() => null)
		throw new Error(`${result.status}: ${errorData?.message ?? result.statusText}`)
	}
	return result.json() as Promise<ChatConfig>
}

export const deleteChatConfig = async (configId: string): Promise<void> => {
	const result = await fetch(`/api/chatconfigs/${configId}`, {
		method: "DELETE"
	})
	if (!result.ok) {
		const errorData = await result.json().catch(() => null)
		throw new Error(`${result.status}: ${errorData?.message ?? result.statusText}`)
	}
}
