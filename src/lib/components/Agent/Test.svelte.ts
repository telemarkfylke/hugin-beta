// Keeps track of the entire state of an agent component (async stuff are allowed here)
import type { AgentState } from "$lib/types/agent-state";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getAgentConversationsYes = async (agentState: AgentState) => {
  // fetch conversations for current agent from api and set agentState.conversations
  agentState.conversations.isLoading = true;
  await sleep(3000); // simulate loading
  agentState.conversations.value = [
    { id: 'conv1', name: 'Conversation 1' },
    { id: 'conv2', name: 'Conversation 2' }
  ];
  agentState.conversations.isLoading = false;
}
