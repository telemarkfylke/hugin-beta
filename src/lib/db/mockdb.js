/**
 * 
 * @returns {Promise<{ agents: import("../types/agents.js").Agents, conversations: {notImplemented}}>}
 */
export const getMockDb = async () => {
  // Try to get mock-db file, else return empty collections
  try {
    // @ts-ignore
    const { mockAgents: agents, mockConversations: conversations } = await import('./mockdb-data.js');
    console.log('./db/mockdb-data.js exists, loaded mockdb, returning mock collections');
    return { agents, conversations };
  } catch (e) {
    console.warn('./db/mockdb-data.js does not exist or is badly formed, returning empty collections');
    return { agents: [], conversations: []
    };
  }
}
