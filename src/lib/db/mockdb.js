// simply in-memory mock database corresponding to collections in mongodb

export const mockAgents = [
  {
    _id: 'mistral',
    name: 'Agent One',
    description: 'This is the first Agent.',
    type: 'mistral',
    config: {
      vendorAgent: {
        id: 'ag_019a34612b1874b087648e86ea134926'
      }
    }
  },
  {
    _id: 'openai',
    name: 'Agent Two',
    description: 'This is the second Agent.',
    type: 'openai',
    config: {
      vendorAgent: {
        id: 'pmpt_68ca8d43f1108197b5c81bd32014f34e04d1daa9ea89d5a0',
        version: '1.0'
      }
    }
  },
  {
    _id: 'openai_not_working',
    name: 'Agent Three',
    description: 'This is the third Agent.',
    type: 'openai',
    config: {
      manualPrompt: {
        topP: 0.9,
        temperature: 0.7,
        maxTokens: 150,
        instructions: {
          system: "You are a helpful Agent.",
        }
      }
    }
  }
]
export const mockConversations = []
