// Keeps track of the entire state of an agent component (async stuff are allowed here)
import type { AgentState } from "$lib/types/agent-state";
import { promptAgent } from "./PromptAgent.svelte.js";
import { getAgentConversationsYes } from "./Test.svelte.js";
import { uploadFilesToConversation } from "./UploadFiles.svelte.js";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// DO NOT set agentState (dont pass it, pass methods) directly from outside this file, always use the provided methods to modify it (to keep it consistent and simpler to understand how changes to state happen)
export const createAgentState = () => {
  const agentState: AgentState = $state({
    agentId: null,
    currentConversation: {
      isLoading: false,
      error: null,
      value: {
        id: null,
        name: null,
        messages: {},
        vectorStores: [],
      }
    },
    conversations: {
      isLoading: false,
      error: null,
      value: []
    }
  })
  const clearConversation = () => {
    agentState.currentConversation = {
      isLoading: false,
      error: null,
      value: {
        id: null,
        name: null,
        messages: {},
        vectorStores: [], // Or the ones connected to the agent by default?
      }
    }
  }
  const getAgentConversations = () => {
    getAgentConversationsYes(agentState)
  }
  const loadConversation = async (conversationId: string | null) => {
    // fetch conversation data from api and set agentState.currentConversation
    agentState.currentConversation.isLoading = true;
    await sleep(3000); // simulate loading
    agentState.currentConversation.value = {
      id: conversationId,
      name: 'Loaded Conversation',
      messages: conversationId === 'conv1' ? {
        'msg1': { role: 'user', content: 'Hello' },
        'msg2': { role: 'agent', content: 'Hi there!' }
      } : {
        'msg3': { role: 'user', content: 'How are you?' },
        'msg4': { role: 'agent', content: 'I am fine, thank you!' }
      },
      vectorStores: []
    };
    agentState.currentConversation.isLoading = false;
  }
  const setCurrentConversationId = (conversationId: string) => {
    agentState.currentConversation.value.id = conversationId
  }
  const changeAgent = async (newAgentId: string) => {
    // reset other needed state, and load the new agent's data
    clearConversation()
    getAgentConversations()
    // Load the new agent's data (maybe set some loading state here?)
    agentState.agentId = newAgentId
  }
  const addUserMessageToConversation = (messageContent: string) => {
    agentState.currentConversation.value.messages[Date.now().toString()] = {
      role: 'user',
      content: messageContent
    }
  }
  const addAgentMessageToConversation = (messageId: string, messageContent: string) => {
    if (!agentState.currentConversation.value.messages[messageId]) {
      agentState.currentConversation.value.messages[messageId] = {
        role: 'agent',
        content: ''
      }
    }
    agentState.currentConversation.value.messages[messageId].content += messageContent
  }
  const postUserPrompt = async (userPrompt: string) => {
    if (!agentState.agentId) {
      throw new Error("Agent ID is not set, you cannot post a prompt without an agentId");
    }
    if (!userPrompt || userPrompt.trim() === '') {
      throw new Error("User prompt is empty, cannot post an empty prompt"); // or just return?
    }
    // Reset error state
    agentState.currentConversation.error = null;
    // First, add the user message to the conversation immediately
    addUserMessageToConversation(userPrompt)
    // Then, prompt the agent and stream the response
    try {
      await promptAgent(
        userPrompt,
        agentState.agentId,
        agentState.currentConversation.value.id,
        setCurrentConversationId,
        addAgentMessageToConversation
      );
    } catch (error) {
      console.error("Error prompting agent:", error);
      agentState.currentConversation.error = (error as Error).message;
    }
  }
  const addKnowledgeFilesToConversation = (files: FileList) => {
    if (!agentState.agentId || !agentState.currentConversation.value.id) {
      throw new Error("agentId and conversationId are required to upload files to a conversation");
    }
    try {
      uploadFilesToConversation(
        files,
        agentState.agentId!,
        agentState.currentConversation.value.id!,
        addAgentMessageToConversation
      )
    } catch (error) {
      console.error("Error uploading files:", error);
      agentState.currentConversation.error = (error as Error).message;
    }
  }
  const deleteKnowledgeFileFromConversation = (fileId: string) => {
    // Ensure vector store exists, delete file from it, check status etc. (check api before implementing)
  }
  const deleteConversation = (conversationId: string) => {
    agentState.conversations.value = agentState.conversations.value.filter(c => c.id !== conversationId);
    if (agentState.currentConversation.value.id === conversationId) {
      clearConversation();
    }
    // And implement db deletion via api, as well as cleanup on provider side
  }
  const createAgentFromConversation = async () => {
    // Implement api call to create a new agent based on the current conversation (then redirect to that agent's page, or something like that)
  }

  return {
    get agentState() {
      return agentState;
    },
    clearConversation,
    changeAgent,
    loadConversation,
    postUserPrompt,
    addKnowledgeFilesToConversation,
    deleteKnowledgeFileFromConversation,
    deleteConversation,
    createAgentFromConversation
  }
}