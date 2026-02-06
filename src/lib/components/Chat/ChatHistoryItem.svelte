<script lang="ts">
	import favicon16 from "$lib/assets/favicon-16x16.png"
	import type { ChatHistoryItem } from "$lib/types/chat"
	import TypingDots from "../TypingDots.svelte"
	import ChatItem from "./ChatItems/MessageItem.svelte"

	type Props = {
		chatHistoryItem: ChatHistoryItem
	}
	let { chatHistoryItem }: Props = $props()

	let copied = $state(false)

	const copyResponse = () => {
		if (chatHistoryItem.type !== "chat_response") return
    console.log('Chatten som ska kopieres:', chatHistoryItem)
		const text = chatHistoryItem.outputs
			.filter((item) => item.type === "message.output")
			.flatMap((item) => item.content)
			.filter((part) => part.type === "output_text")
			.map((part) => ("text" in part ? part.text : ""))
			.join("\n")
		navigator.clipboard.writeText(text)
		copied = true
		setTimeout(() => {
			copied = false
		}, 2000)
	}
</script>

{#if chatHistoryItem.type === 'message.input'}
  <ChatItem chatItem={chatHistoryItem} />
{/if}
{#if chatHistoryItem.type === 'chat_response'}
  <div class="chat-response">
    <h5 class="chat-response-header"><img src={favicon16} alt="favicon" /> {chatHistoryItem.config.name}</h5>
    {#if chatHistoryItem.status === "queued" || chatHistoryItem.status === "in_progress" && chatHistoryItem.outputs.length === 0}
      <TypingDots />
    {:else}
      {#each chatHistoryItem.outputs as chatItem}
        <ChatItem {chatItem} />
      {/each}
    {/if}
    {#if chatHistoryItem.status === "completed"}
      <div class="chat-response-actions">
        <button class="icon-button" onclick={copyResponse} title="Kopier">
          <span class="material-symbols-outlined">{copied ? "check" : "content_copy"}</span>
          {#if copied}Kopiert!{/if}
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .chat-response-header {
    /* Align items center */
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
  .chat-response-actions {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }
  .chat-response-actions button {
    font-size: 0.8rem;
  }
</style>