<script lang="ts">
	import type { ChatInputMessage, ChatResponseObject } from "$lib/types/chat"
    import TypingDots from "../TypingDots.svelte";
	import ChatMessageItem from "./ChatMessageItem.svelte"

	type Props = {
		chatConfigName: string
		chatMessage: ChatInputMessage | ChatResponseObject
	}
	let { chatMessage, chatConfigName }: Props = $props()
</script>

{#if chatMessage.type === 'message'}
  <ChatMessageItem chatItem={chatMessage} />
{/if}
{#if chatMessage.type === 'chat_response'}
  <div class="chat-response">
    <h4>{chatConfigName} ({chatMessage.status})</h4>
    {#if chatMessage.status === "queued" || chatMessage.status === "in_progress" && chatMessage.outputs.length === 0}
      <TypingDots />
    {:else}
      {#each chatMessage.outputs as chatItem}
        <ChatMessageItem {chatItem} />
      {/each}
    {/if}
    <!--
    <div class="chat-response-usage">
      Usage: {chatMessage.usage ? `Prompt tokens: ${chatMessage.usage.inputTokens}, Completion tokens: ${chatMessage.usage.outputTokens}, Total tokens: ${chatMessage.usage.totalTokens}` : 'N/A'}
    </div>
    -->
  </div>
{/if}
