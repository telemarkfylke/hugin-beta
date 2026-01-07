import type { DBAgent, DBAgentPatchInput } from "$lib/types/agents"
import type { IAgentStore, NewAgentInput } from "./interface"

export class MockAgentStore implements IAgentStore {
	private agents: DBAgent[] = []

	constructor(initData?: DBAgent[]) {
		if (initData) {
			this.agents.push(...initData)
		}
	}

	async getAgent(agentId: string): Promise<DBAgent | null> {
		const foundAgent = this.agents.find((agent) => agent._id === agentId)
		if (!foundAgent) {
			return null
		}

		return JSON.parse(JSON.stringify(foundAgent)) // Return a deep copy for not reference issues
	}
	async getAgents(): Promise<DBAgent[]> {
		return this.agents.map((agent) => JSON.parse(JSON.stringify(agent)))
	}
	async createAgent(newAgent: NewAgentInput): Promise<DBAgent> {
		const newMockAgent = { _id: crypto.randomUUID(), ...newAgent }
		this.agents.push(newMockAgent)
		return newMockAgent
	}
	async updateAgent(agentId: string, agentUpdateInput: DBAgentPatchInput): Promise<DBAgent> {
		const agentToUpdate = this.agents.find((agent) => agent._id === agentId)
		if (!agentToUpdate) {
			throw new Error(`Agent ${agentId} not found`)
		}
		for (const [key, value] of Object.entries(agentUpdateInput)) {
			// @ts-expect-error DETTE ER BARE MOCK
			agentToUpdate[key] = value
		}
		return JSON.parse(JSON.stringify(agentToUpdate)) // Return a deep copy for not reference issues
	}
}
