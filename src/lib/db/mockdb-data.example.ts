// simply in-memory mock database corresponding to collections in mongodb

/** @type {import("$lib/types/agents.js").Agents} */
export const mockAgents = [
  {
    _id: 'mistral',
    name: 'Mistral demo agent',
    description: 'Mistral agent based on an agent in mistral - connected to a mistral agent id',
    config: {
      type: 'mistral-agent',
      agentId: 'ag_019a34612b1874b087648e86ea134926' // example mistral agent id
    }
  },
  {
    _id: 'openai',
    name: 'Open AI prompt demo agent',
    description: 'An agent that uses an OpenAI prompt-id as its configuration (saved prompt in OpenAI)',
    config: {
      type: 'openai-prompt',
      prompt: {
        id: 'pmpt_68ca8d43f1108197b5c81bd32014f34e04d1daa9ea89d5a0' // example OpenAI prompt id
      }
    }
  }
]

// TODO: add types for conversations
export const mockConversations = []
