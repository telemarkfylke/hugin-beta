import type { DBAgent, DBAgentPatchInput } from "$lib/types/agents"
import type { IAgentStore, NewAgentInput } from "./interface"

export class MongoAgentStore implements IAgentStore {
	getAgent(_agentId: string): Promise<DBAgent | null> {
		throw new Error("MongoAgentStore not implemented.")
	}
	getAgents(): Promise<DBAgent[]> {
		throw new Error("MongoAgentStore not implemented.")
	}
	createAgent(_newAgent: NewAgentInput): Promise<DBAgent> {
		throw new Error("MongoAgentStore not implemented.")
	}
	updateAgent(_agentId: string, _agentUpdateInput: DBAgentPatchInput): Promise<DBAgent> {
		throw new Error("MongoAgentStore not implemented.")
	}
}
