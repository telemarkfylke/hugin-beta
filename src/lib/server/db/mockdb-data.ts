// simply in-memory mock database corresponding to collections in mongodb

import type { Agent, Conversation } from "$lib/types/agents.ts"

export const agents: Agent[] = [
  {
    _id: 'mistral',
    name: 'Mistral demo agent',
    description: 'Mistral agent based on an agent in mistral - connected to a mistral agent id',
    config: {
      type: 'mistral-conversation',
      agentId: 'en id til en agent i mistral',
    }
  },
  {
    _id: 'mistral-conversation',
    name: 'Mistral rett på conversation',
    description: 'Mistral agent som går rett på en model og conversation',
    config: {
      type: 'mistral-conversation',
      model: 'mistral-medium-latest',
      instructions: 'You are a helpful assistant that answers in Norwegian. Always search document libraries before answering user questions.',
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
          libraryIds: ['a library id fra mistral her']
        }
      ]
    }
  },
  {
    _id: 'openai_prompt',
    name: 'Open AI prompt demo agent',
    description: 'An agent that uses an OpenAI prompt-id as its configuration (saved prompt in OpenAI)',
    config: {
      type: 'openai-response',
      prompt: {
        id: 'a prompt id from OpenAI here'
      }
    }
  },
  {
    _id: 'openai_response_4o',
    name: 'Open AI demo agent',
    description: 'An agent that uses an OpenAI response configuration with gpt-4o model',
    config: {
      type: 'openai-response',
      model: 'gpt-4o'
    }
  }
]

export const conversations: Conversation[] = []
