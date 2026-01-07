import type { DBAgent, DBAgentPatchInput } from "$lib/types/agents"

export type NewAgentInput = Omit<DBAgent, "_id">

export interface IAgentStore {
	getAgent(agentId: string): Promise<DBAgent | null>
	getAgents(): Promise<DBAgent[]>
	createAgent(newAgent: NewAgentInput): Promise<DBAgent>
	updateAgent(agentId: string, agentUpdateInput: DBAgentPatchInput): Promise<DBAgent>
}
