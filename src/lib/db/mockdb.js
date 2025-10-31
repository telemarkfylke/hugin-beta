// simply in-memory mock database corresponding to collections in mongodb

export const mockAssistants = [
  {
    _id: 'mistral',
    name: 'Assistant One',
    description: 'This is the first assistant.',
    type: 'mistral',
    config: {
      vendorAssistant: {
        id: 'ag_019a34612b1874b087648e86ea134926'
      }
    }
  },
  {
    _id: 'openai',
    name: 'Assistant Two',
    description: 'This is the second assistant.',
    type: 'openai',
    config: {
      vendorAssistant: {
        id: 'pmpt_68ca8d43f1108197b5c81bd32014f34e04d1daa9ea89d5a0',
        version: '1.0'
      }
    }
  },
  {
    _id: 'openai_not_working',
    name: 'Assistant Three',
    description: 'This is the third assistant.',
    type: 'openai',
    config: {
      manualPrompt: {
        topP: 0.9,
        temperature: 0.7,
        maxTokens: 150,
        instructions: {
          system: "You are a helpful assistant.",
        }
      }
    }
  }
]
export const mockConversations = []
