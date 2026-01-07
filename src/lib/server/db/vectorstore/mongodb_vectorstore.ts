import type { DeleteResult, ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import type { CreateContextConfig, VectorChunk, VectorContext } from "$lib/server/db/vectorstore/types"
import type { VectorStoreFile } from "$lib/types/vector-store"
import { getMongoClient } from "../mongodb"
import type { IVectorStoreDb } from "./interface"

type MongoDocument = {
	_id?: ObjectId
}

type MongoChunk = VectorChunk &
	MongoDocument & {
		contextId: string
	}

type MongoContext = VectorContext & MongoDocument

export class MongoVectorStoreDb implements IVectorStoreDb {
	static dbName: string = env.MONGO_DB
	static vectorIndexName: string = env.MONGO_VECTORINDEX
	static chunckCollection: string = "vectorchunks"
	static contextCollection: string = "vectorcontexts"

	private createLookup(id: string): MongoDocument {
		return {
			_id: id as unknown
		} as MongoDocument
	}

	public async getContexts(): Promise<VectorContext[]> {
		const client = await getMongoClient()
		const documents = (await client.db(MongoVectorStoreDb.dbName).collection(MongoVectorStoreDb.contextCollection).find().toArray()) as MongoContext[]
		return documents.map((value) => {
			return value as VectorContext
		})
	}

	public async getContext(id: string): Promise<VectorContext | null> {
		const client = await getMongoClient()
		const response = await client.db(MongoVectorStoreDb.dbName).collection(MongoVectorStoreDb.contextCollection).findOne(this.createLookup(id))
		if (!response) return null

		const document = response as MongoContext
		return document as VectorContext
	}

	public async createContext(config: CreateContextConfig): Promise<VectorContext> {
		const client = await getMongoClient()
		const id = crypto.randomUUID()
		const input: MongoContext = {
			_id: id as unknown as ObjectId,
			contextId: id,
			name: config.name || "",
			files: {},
			createdAt: new Date().toISOString()
		}

		const response = await client.db(MongoVectorStoreDb.dbName).collection(MongoVectorStoreDb.contextCollection).insertOne(input)

		if (response.insertedId.toString() === id) {
			return input as VectorContext
		}

		throw new Error("Could not insert context")
	}

	public async makeFile(_context: string, filename: string, bytes: number): Promise<VectorStoreFile> {
		const client = await getMongoClient()

		const fileId = crypto.randomUUID()
		const file: VectorStoreFile = { id: fileId, name: filename, type: "", bytes: bytes, status: "processing" /*regDate: new Date().toISOString()*/ }

		const fileInsert: Record<string, object> = {}
		fileInsert[`files.${fileId}`] = file

		// update context
		await client
			.db(MongoVectorStoreDb.dbName)
			.collection(MongoVectorStoreDb.contextCollection)
			.updateOne({ _id: _context as unknown as ObjectId }, { $set: fileInsert })
		return file
	}

	public async getFiles(contextId: string): Promise<VectorStoreFile[]> {
		const context = await this.getContext(contextId)
		if (!context) {
			return []
		}

		return Object.entries(context.files).map(([_key, value]) => {
			return value
		})
	}

	public async removeFile(context: string, fileId: string): Promise<number> {
		const client = await getMongoClient()

		// Remove from chunks
		const chunksRemoved: DeleteResult = await client.db(MongoVectorStoreDb.dbName).collection(MongoVectorStoreDb.chunckCollection).deleteMany({ fileId: fileId, contextId: context })

		const fileRemove: Record<string, string> = {}
		fileRemove[`files.${fileId}`] = ""

		// Remove from context
		await client
			.db(MongoVectorStoreDb.dbName)
			.collection(MongoVectorStoreDb.contextCollection)
			.updateOne({ _id: context as unknown as ObjectId }, { $unset: fileRemove })

		return chunksRemoved.deletedCount
	}

	public async addVectorData(context: string, fileId: string, texts: string[], matrixes: number[][]): Promise<void> {
		if (texts.length !== matrixes.length) {
			throw new Error("Vector texts and matrixes length does not match")
		}

		const client = await getMongoClient()
		for (let i = 0; i < texts.length; i++) {
			const document = { contextId: context, text: texts[i] as string, vectorMatrix: matrixes[i] as number[], fileId: fileId }
			await client.db(MongoVectorStoreDb.dbName).collection(MongoVectorStoreDb.chunckCollection).insertOne(document)
		}
	}

	public async search(vectorContexts: string[], queryVector: number[]): Promise<string[]> {
		if (!MongoVectorStoreDb.vectorIndexName) {
			throw new Error("Vector index name must be defined")
		}

		const client = await getMongoClient()

		const pipeline = [
			{
				$vectorSearch: {
					index: MongoVectorStoreDb.vectorIndexName,
					path: "vectorMatrix",
					queryVector: queryVector,
					numCandidates: 100,
					limit: 3,
					filter: {
						$and: [{ contextId: { $in: vectorContexts } }]
					}
				}
			},
			{
				$project: {
					text: 1,
					score: { $meta: "vectorSearchScore" }
				}
			}
		]

		const documents = await client.db(MongoVectorStoreDb.dbName).collection(MongoVectorStoreDb.chunckCollection).aggregate<MongoChunk>(pipeline).toArray()
		return documents.map((value) => {
			return value.text
		})
	}
}
