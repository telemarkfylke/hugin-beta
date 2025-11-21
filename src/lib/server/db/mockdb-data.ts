// simply in-memory mock database corresponding to collections in mongodb

import type { Agent, Conversation } from "$lib/types/agents.ts"

export const agents: Agent[] = [
  {
    _id: 'mistral-conversation',
    name: 'Mistral',
    description: 'Mistral agent som går rett på en model og conversation',
    config: {
      type: 'mistral-conversation',
      model: 'mistral-medium-latest',
      instructions: 'You are a helpful assistant that answers in Norwegian.',
      fileSearchEnabled: true,
      webSearchEnabled: false
    }
  },
  {
    _id: 'mistral-conversation-swedish',
    name: 'Mistral på svensk',
    description: 'Mistral agent som går rett på en model og conversation',
    config: {
      type: 'mistral-conversation',
      model: 'mistral-medium-latest',
      instructions: 'You are a helpful assistant that answers in Swedish.',
      fileSearchEnabled: false,
      webSearchEnabled: false
    }
  },
  {
    _id: 'openai_response_4o',
    name: 'Open AI demo agent',
    description: 'An agent that uses an OpenAI response configuration with gpt-4o model',
    config: {
      type: 'openai-response',
      model: 'gpt-4o',
      instructions: null,
      fileSearchEnabled: true,
      webSearchEnabled: false
    }
  },
  {
    _id: 'openai_response_4o_2',
    name: 'Sarkastisk',
    description: 'An agent that uses an OpenAI response configuration with gpt-4o model',
    config: {
      type: 'openai-response',
      model: 'gpt-4o',
      instructions: 'Svar sarkastisk og kort på alt',
      fileSearchEnabled: false,
      webSearchEnabled: false
    }
  },
  {
    _id: 'openai_response_4o_TROLL',
    name: 'Nettroll',
    description: 'An agent that uses an OpenAI response configuration with gpt-4o model',
    config: {
      type: 'openai-response',
      model: 'gpt-4o',
      instructions: 'Svar som et nettroll i et kommentarfelt på en luguber nettside',
      fileSearchEnabled: false,
      webSearchEnabled: false
    }
  },
  {
    _id: 'ollama_basic',
    name: 'Ollama basic orakel',
    description: 'A basic ollama bot',
    config: {
      type: 'ollama-response',
      model: '',
      instructions: 'Svar veldig generelt på spessifike spørsmål'
    }
  }
]

export const conversations: Conversation[] = []
