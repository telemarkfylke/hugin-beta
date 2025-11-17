import type { Agent } from "./agents";

type AgentConversationMessage = {
  role: 'user' | 'agent';
  content: string;
}

type AgentVectorStoreFile = {
  id: string;
  name: string;
  type: string;
  summary: string | null;
  size: number;
}

type CurrentAgentConversation = {
  isLoading: boolean;
  error: string | null;
  value: {
    id: string | null;
    name: string | null;
    messages: Record<string, AgentConversationMessage>;
    files: AgentVectorStoreFile[];
  }
}

export type AgentInfo = {
  isLoading: boolean;
  error: string | null;
  value: Agent | null;
}

type AgentConversation = {
  id: string;
  name: string;
};

// Might be funny to add agent data and user configuration as well later?
export type AgentState = {
  agentId: string | null;
  agentInfo: AgentInfo;
  currentConversation: CurrentAgentConversation;
  conversations: {
    isLoading: boolean;
    error: string | null;
    value: AgentConversation[];
  }
}

export type AgentStateHandler = {
  readonly agentState: AgentState;
  clearConversation: () => void;
  changeAgent: (newAgentId: string) => Promise<void>;
  getAgentInfo: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  postUserPrompt: (userPrompt: string) => Promise<void>;
  addKnowledgeFilesToConversation: (files: FileList) => void;
  refreshConversationFiles: () => Promise<void>;
  deleteKnowledgeFileFromConversation: (fileId: string) => void;
  deleteConversation: (conversationId: string) => void;
  createAgentFromConversation: () => Promise<void>;
};
