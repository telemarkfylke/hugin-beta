// simply in-memory mock database corresponding to collections in mongodb

import type { Agent } from "$lib/types/agents.ts"

export const agents: Agent[] = [
  {
    _id: 'mistral',
    name: 'Mistral demo agent',
    description: 'Mistral agent based on an agent in mistral - connected to a mistral agent id',
    config: {
      type: 'mistral-conversation',
      agentId: 'en id her'
    }
  },
  {
    _id: 'mistral-conversation',
    name: 'Mistral rett på conversation',
    description: 'Mistral agent som går rett på en model og conversation',
    config: {
      type: 'mistral-conversation',
      model: 'mistral-medium-latest'
    }
  },
  {
    _id: 'mistral-conversation-with-library',
    name: 'Mistral Styrende Dokumenter Agent',
    description: 'Mistral agent som svarer basert på dokumenter i et dokumentbibliotek i Mistral',
    config: {
      type: 'mistral-conversation',
      model: 'mistral-medium-latest',
      tools: [
        {
          type: 'document_library',
          libraryIds: ['en id til et dokumentbibliotek her']
        }
      ]
    }
  },
  {
    _id: 'openai',
    name: 'Open AI prompt demo agent',
    description: 'An agent that uses an OpenAI prompt-id as its configuration (saved prompt in OpenAI)',
    config: {
      type: 'openai-prompt',
      prompt: {
        id: 'en id her'
      }
    }
  }
]

// TODO: add types for conversations
export const conversations = []
