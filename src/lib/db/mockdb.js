/**
 * 
 * @returns {Promise<{ agents: import("../types/agents.js").Agents, conversations: {notImplemented}}>}
 */
export const getMockDb = async () => {
  // We add the mock agent here so it is always present in the mock db
  /** @type {import("$lib/types/agents.js").Agent} */
  const mockAgent = {
    _id: 'mock-agent',
    name: 'Mock AI agent, which responds with streaming mock data (no real AI or cost)',
    description: 'Mock agent that simulates AI responses',
    config: {
      type: 'mock-agent'
    }
  }
  try {
    // @ts-ignore
    const { agents, conversations } = await import('./mockdb-data.js');
    console.log('./db/mockdb-data.js exists, loaded mockdb, returning mock collections');
    return { agents: [mockAgent, ...agents], conversations };
  } catch (e) {
    console.warn('./db/mockdb-data.js does not exist or is badly formed, returning empty collections');
    return { agents: [mockAgent], conversations: [] }
  }
}
