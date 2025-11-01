import { env } from "$env/dynamic/private";

let mockDbData = null

if (env.MOCK_DB === 'true') {
  const { getMockDb } = await import('$lib/db/mockdb.js');
  mockDbData = await getMockDb();
  console.log(mockDbData)
}

/**
 * 
 * @param {string} agentId 
 * @returns {Promise<import("$lib/types/agents.js").Agent>}
 */
export const getAgent = async (agentId) => {
  if (mockDbData) {
    const foundAgent = mockDbData.agents.find(agent => agent._id === agentId);
    if (!foundAgent) {
      throw new Error('Agent not found');
    }
    return foundAgent;
  }
  throw new Error('Not implemented - please set MOCK_DB to true in env');
  // Implement real DB fetch here
}

/**
 * 
 * @returns {Promise<import("$lib/types/agents.js").Agent[]>}
 */
export const getAgents = async () => {
  if (mockDbData) {
    console.log('Returning agents from mockDbData', mockDbData.agents);
    return mockDbData.agents;
  }
  throw new Error('Not implemented - please set MOCK_DB to true in env');
  // Implement real DB fetch here
}

