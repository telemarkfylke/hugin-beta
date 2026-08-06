import { getConversationStore } from "$lib/server/db/get-db"
import { ConversationManager } from "./conv_manager"

const conversationManager = new ConversationManager(getConversationStore())

export const getConversationManager = (): ConversationManager => {
	return conversationManager
}
