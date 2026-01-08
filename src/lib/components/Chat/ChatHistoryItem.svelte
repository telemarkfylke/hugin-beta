<script lang="ts">
	import type { ChatHistoryItem } from "$lib/types/chat"
  import TypingDots from "../TypingDots.svelte";
	import ChatItem from "./ChatItems/MessageItem.svelte"

	type Props = {
		chatHistoryItem: ChatHistoryItem
	}
	let { chatHistoryItem }: Props = $props()
</script>

{#if chatHistoryItem.type === 'message.input'}
  <ChatItem chatItem={chatHistoryItem} />
{/if}
{#if chatHistoryItem.type === 'chat_response'}
  <div class="chat-response">
    <h4>{chatHistoryItem.config.name}</h4>
    {#if chatHistoryItem.status === "queued" || chatHistoryItem.status === "in_progress" && chatHistoryItem.outputs.length === 0}
      <TypingDots />
    {:else}
      {#each chatHistoryItem.outputs as chatItem}
        <ChatItem {chatItem} />
      {/each}
    {/if}
    <!--
    <div class="chat-response-usage">
      Usage: {chatMessage.usage ? `Prompt tokens: ${chatMessage.usage.inputTokens}, Completion tokens: ${chatMessage.usage.outputTokens}, Total tokens: ${chatMessage.usage.totalTokens}` : 'N/A'}
    </div>
    -->
  </div>
{/if}
