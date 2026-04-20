<script lang="ts">
	import { onMount } from "svelte"
	import { page } from "$app/stores"
	import ChatComponent from "$lib/components/Chat/Chat.svelte"
	import { ChatState } from "$lib/components/Chat/ChatState.svelte.js"
	import WelcomeSplash from "$lib/components/WelcomeSplash.svelte"
	import type { FeatureMap } from "$lib/features/featuremap"
	import { getFeatures } from "$lib/features/service"
	import type { Chat } from "$lib/types/chat"
	import type { PageProps } from "./$types"

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

	let showSplash = $state($page.url.searchParams.has("splash"))

	let featureMap: FeatureMap = $state({})

	onMount(async () => {
		featureMap = await getFeatures()
	})
</script>

<ChatComponent {chatState} {featureMap} />
<WelcomeSplash bind:show={showSplash} />

<!--<button onclick={() => chatState.loadChat('hahah')}>Load chat 'hahah'</button>-->
