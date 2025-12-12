import { env } from "$env/dynamic/private"
import type { DBAgent, IAgent, DBAgentInput } from "$lib/types/agents.ts"
import { MistralAgent } from "../mistral/mistral-agent.js"
import { MockAIAgent } from "../mock-ai/mock-ai-agent"
import { OllamaAgent } from "../ollama/ollama-agent"
import { OpenAIAgent } from "../openai/openai-agent"
import { getMongoClient, type MongoDocument } from "../db/mongodb";
import type { MongoClient } from "mongodb"

let mockDbData = null

if (env.MOCK_DB === "true") {
	const { getMockDb } = await import("$lib/server/db/mockdb.js")
	mockDbData = await getMockDb()
	// console.log(mockDbData)
}

export const createDBAgent = async (agentData: DBAgentInput): Promise<DBAgent> => {
	if (mockDbData) {
		const agent: DBAgent = {
			...agentData,
			_id: crypto.randomUUID()
		}
		mockDbData.agents.push(agent)
		return agent
	}

	const mongoClient: MongoClient = await getMongoClient()
	const insertedDocument = await mongoClient.db(env.MONGO_DB).collection('agents').insertOne(agentData)	
	const agent: DBAgent = {
		...agentData,
		_id: insertedDocument.insertedId as unknown as string
	}
	
	return agent

	//throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

export const getDBAgent = async (agentId: string): Promise<DBAgent> => {
	if (mockDbData) {
		const foundAgent = mockDbData.agents.find((agent) => agent._id === agentId)
		if (!foundAgent) {
			throw new Error("Agent not found")
		}
		return JSON.parse(JSON.stringify(foundAgent))
	}

	const mongoClient: MongoClient = await getMongoClient()
	const doc:any = await mongoClient.db(env.MONGO_DB).collection('agents').findOne({ _id: agentId as any})
	if (!doc){
		throw new Error("Agent not found")
	}
	return doc as DBAgent

	//throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

export const getDBAgents = async (): Promise<DBAgent[]> => {
	if (mockDbData) {
		console.log("Returning agents from mockDbData", mockDbData.agents)
		return mockDbData.agents.map((agent) => JSON.parse(JSON.stringify(agent)))
	}

	const mongoClient: MongoClient = await getMongoClient()
	const response = await mongoClient.db(env.MONGO_DB).collection('agents')
	.find().sort({ 'name': 1 }) /*.skip(pageSize * page).limit(pageSize)*/

	const documents = await response.toArray() as unknown as DBAgent[];
	return documents

	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

export const createAgent = (dbAgent: DBAgent): IAgent => {
	if (dbAgent.config.type === "mock-agent") {
		return new MockAIAgent()
	}
	if (dbAgent.config.type === "mistral-conversation" || dbAgent.config.type === "mistral-agent") {
		return new MistralAgent(dbAgent)
	}
	if (dbAgent.config.type === "openai-response" || dbAgent.config.type === "openai-prompt") {
		return new OpenAIAgent(dbAgent)
	}
	if (dbAgent.config.type === "ollama-response") {
		return new OllamaAgent(dbAgent)
	}
	throw new Error(`Unsupported agent: ${dbAgent.name}`)
}
