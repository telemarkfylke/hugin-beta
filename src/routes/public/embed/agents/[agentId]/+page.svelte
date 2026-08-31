<script lang="ts">
	import { ANONYMOUS_PRINCIPAL } from "$lib/anonymous-principal"
	import { ChatState } from "$lib/components/Chat/ChatState.svelte"
	import EmbedWidgetChrome from "$lib/components/Chat/EmbedWidgetChrome.svelte"
	import type { Chat } from "$lib/types/chat"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()

	const initialChat: Chat = {
		_id: "",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		owner: {
			id: ANONYMOUS_PRINCIPAL.userId
		},
		config: data.agent,
		history: []
	}

	// Synthetic anonymous principal, forced incognito, and its own unauthenticated API endpoint -
	// no login, no persisted conversation, ever. Tools are locked, not left to the visitor: live
	// web search is an open-ended cost/abuse surface with no accountable owner, so it's forced off;
	// a configured knowledge base (RAG datasource) is the intended "brain" of the embedded agent, so
	// it's forced on since there's no config UI here for anyone to turn it on themselves.
	const embedChatState = new ChatState(initialChat, ANONYMOUS_PRINCIPAL, data.APP_CONFIG, {
		apiEndpoint: "/public/embed/api/chat",
		canUseHistory: false,
		lockedTools: { webSearch: false, datasource: true }
	})
</script>

<EmbedWidgetChrome chatState={embedChatState} />
