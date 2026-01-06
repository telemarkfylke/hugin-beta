<script lang="ts">
	import Chat from "$lib/components/Chat/Chat.svelte"
	import type { ConfigurableChatConfig } from "$lib/components/Chat/types"

	const defaultChatConfig: ConfigurableChatConfig = {
		vendorId: "openai",
		model: "gpt-4o"
	}
</script>

<div>
	<Chat initialChatConfig={defaultChatConfig} />
</div>
