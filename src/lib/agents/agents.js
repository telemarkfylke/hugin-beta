import { env } from "$env/dynamic/private";
import { mockAgents } from "$lib/db/mockdb.js";

/**
 * 
 * @param {string} agentId 
 * @returns {Promise<import("$lib/types/agents.js").Agent>}
 */
export const getAgent = async (agentId) => {
  if (env.MOCK_DB === 'true') {
    const foundAgent = mockAgents.find(agent => agent._id === agentId);
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
  if (env.MOCK_DB === 'true') {
    return mockAgents;
  }
  throw new Error('Not implemented - please set MOCK_DB to true in env');
  // Implement real DB fetch here
}

