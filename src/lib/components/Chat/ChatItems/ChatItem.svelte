<script lang="ts">
  import type { ChatItem } from "$lib/types/chat-item";
    import MessageItem from "./MessageItem.svelte";

	type Props = {
		chatItem: ChatItem
	}
	let { chatItem }: Props = $props()

</script>

{#if chatItem.type === 'message.input' || chatItem.type === 'message.output'}
  <MessageItem {chatItem} />
{/if}

