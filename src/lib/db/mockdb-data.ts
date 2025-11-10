// simply in-memory mock database corresponding to collections in mongodb

/** @type {import("$lib/types/agents.js").Agents} */
export const agents = [
  {
    _id: 'mistral',
    name: 'Mistral demo agent',
    description: 'Mistral agent based on an agent in mistral - connected to a mistral agent id',
    config: {
      type: 'mistral-conversation',
      agentId: 'ag_019a34612b1874b087648e86ea134926'
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
          libraryIds: ['019a350f-9baf-7772-baa9-d91ecc24f61b']
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
        id: 'pmpt_68ca8d43f1108197b5c81bd32014f34e04d1daa9ea89d5a0'
      }
    }
  }
]

// TODO: add types for conversations
export const conversations = []
