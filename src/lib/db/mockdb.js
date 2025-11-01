// simply in-memory mock database corresponding to collections in mongodb

/** @type {Array<import("$lib/types/agents.js").Agent>} */
export const mockAgents = [
  {
    _id: 'mistral',
    name: 'Agent One',
    description: 'This is the first Agent.',
    config: {
      type: 'mistral-agent',
      agentId: 'ag_019a34612b1874b087648e86ea134926'
    }
  },
  {
    _id: 'openai',
    name: 'Agent Two',
    description: 'This is the second Agent.',
    config: {
      type: 'openai-prompt',
      prompt: {
        id: 'pmpt_68ca8d43f1108197b5c81bd32014f34e04d1daa9ea89d5a0'
      }
    }
  }
]

// TODO: add types for conversations
export const mockConversations = []
