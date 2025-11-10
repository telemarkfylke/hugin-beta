import { env } from "$env/dynamic/private";
import type { Agent } from "$lib/types/agents.ts";

let mockDbData = null

if (env.MOCK_DB === 'true') {
  const { getMockDb } = await import('$lib/db/mockdb.js');
  mockDbData = await getMockDb();
  // console.log(mockDbData)
}

export const getAgent = async (agentId: string): Promise<Agent> => {
  if (mockDbData) {
    const foundAgent = mockDbData.agents.find(agent => agent._id === agentId);
    if (!foundAgent) {
      throw new Error('Agent not found');
    }
    return JSON.parse(JSON.stringify(foundAgent));
  }
  throw new Error('Not implemented - please set MOCK_DB to true in env');
  // Implement real DB fetch here
}

export const getAgents = async (): Promise<Agent[]> => {
  if (mockDbData) {
    console.log('Returning agents from mockDbData', mockDbData.agents);
    return mockDbData.agents.map(agent => JSON.parse(JSON.stringify(agent)));
  }
  throw new Error('Not implemented - please set MOCK_DB to true in env');
  // Implement real DB fetch here
}

