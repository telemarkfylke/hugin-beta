import { env } from "$env/dynamic/private"
import { MongoClient } from "mongodb"
import { ObjectId } from "mongodb"

export type MongoDocument = {
	_id: ObjectId
}

let client: MongoClient | null = null

export const getMongoClient = async (): Promise<MongoClient> => {
	// Placeholder function to simulate getting a MongoDB client
	if (!client) {
		client = new MongoClient(env.MONGO_CONNECTIONSTRING || "mongodb://localhost:27017")
		await client.connect()
	}
	return client
}