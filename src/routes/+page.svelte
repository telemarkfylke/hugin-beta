<script lang="ts">
	import ChatComponent from "$lib/components/Chat/Chat.svelte"
	import { ChatState } from "$lib/components/Chat/ChatState.svelte.js"
	import FeatureSpotlight from "$lib/components/FeatureSpotlight.svelte"
	import type { Chat } from "$lib/types/chat"
	import type { PageProps } from "./$types"

	// Splash shown to everyone on entering the app. Fill in with real copy.
	// `splashId` must change whenever the copy changes, or users who dismissed
	// the old message will never see the new one.
	const splashId = "Bilvask-123"
	const splashIcon = "auto_awesome" // e.g. "auto_awesome" - see https://fonts.google.com/icons
	const splashHeader = "Historikk i Hugin"
	const splashText = `Hugin husker nå samtalene du har med den.

						Samtaler lagres automatisk. Du kan slette gamle samtaler eller gjenoppta en samtale under <span class="spotlight-pill"><span class="material-symbols-rounded">history</span>Samtaler</span> i toppmenyen.`
	const splashSubtext = "" // optional - leave empty to omit

	let { data }: PageProps = $props()

	// Defaultchatten
	const defaultChat: Chat = {
		_id: "",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		owner: {
			id: data.authenticatedUser.userId,
			name: data.authenticatedUser.name
		},
		config: data.agent,
		history: []
	}

	// svelte-ignore state_referenced_locally (don't care, user is user, APP_CONFIG is APP_CONFIG. If somebody messes with them, backend must handle that)
	const chatState = new ChatState(defaultChat, data.authenticatedUser, data.APP_CONFIG)
</script>

<ChatComponent {chatState} />

<FeatureSpotlight
	id={splashId}
	icon={splashIcon}
	header={splashHeader}
	text={splashText}
	subtext={splashSubtext}
	placement="top-center"
	backdrop
/>

<!--<button onclick={() => chatState.loadChat('hahah')}>Load chat 'hahah'</button>-->