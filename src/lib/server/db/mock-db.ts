import type { ChatConfig } from "$lib/types/chat";
import type { IChatConfigStore } from "$lib/types/db/db-interface";

const mockChatConfigs: ChatConfig[] = [
  {
    _id: "1234",
    name: "Snille Mistral",
    description: "En snill Mistral",
    vendorId: "mistral",
    project: "DEFAULT",
    model: "mistral-medium-latest",
    instructions: "Answer in Norwegian. Be overly polite and friendly."
  },
  {
    _id: "5678",
    name: "Sure OpenAI",
    description: "En sur OpenAI",
    vendorId: "openai",
    project: "DEFAULT",
    model: "gpt-4o",
    instructions: "Answer in Norwegian. Be very grumpy and sarcastic."
  }
]

export class MockChatConfigStore implements IChatConfigStore {
  async getChatConfig(configId: string): Promise<ChatConfig | null> {
    const config = mockChatConfigs.find((config) => config._id === configId) || null;
    return config
  }
  async getChatConfigs(): Promise<ChatConfig[]> {
    return mockChatConfigs
  }
  async createChatConfig(ChatConfig: Omit<ChatConfig, "_id">): Promise<ChatConfig> {
    const newConfig: ChatConfig = { ...ChatConfig, _id: Date.now().toString() };
    mockChatConfigs.push(newConfig);
    return newConfig;
  }
  async updateChatConfig(configId: string, chatConfigUpdateInput: Partial<ChatConfig>): Promise<ChatConfig> {
    const config = mockChatConfigs.find((config) => config._id === configId);
    if (!config) throw new Error("ChatConfig not found");
    Object.assign(config, chatConfigUpdateInput);
    return config;
  }
}

