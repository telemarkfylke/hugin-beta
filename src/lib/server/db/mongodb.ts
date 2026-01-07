import { MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"

let client: MongoClient | null = null

export const getMongoClient = async (): Promise<MongoClient> => {
	// Placeholder function to simulate getting a MongoDB client
	if (!client) {
		client = new MongoClient(env.MONGO_CONNECTIONSTRING)
		await client.connect()
	}
	return client
}

export async function closeMongoClient() {
	if (client) client.close()
	client = null
}
