import type { CreateContextConfig, VectorChunk, VectorContext } from "$lib/server/db/vectorstore/types"
import type { VectorStoreFile } from "$lib/types/vector-store"
import type { IVectorStoreDb } from "./interface"

enum FilterType {
	Highest,
	Treshold
}

export class MockVectorStoreDb implements IVectorStoreDb {
	static contexts: Record<string, VectorContext>
	static chunks: Record<string, VectorChunk[]> = {}

	private filterType: FilterType

	constructor(filterType?: FilterType) {
		this.filterType = filterType || FilterType.Highest
	}

	private getContextsDictionary(): Record<string, VectorContext> {
		if (!MockVectorStoreDb.contexts) {
			// Just make some premade placeholder stores so that we can have agents configured to a vectorstore
			MockVectorStoreDb.contexts = {
				"7ae6deb1-5f45-4770-9699-fa84e3793b72": {
					contextId: "7ae6deb1-5f45-4770-9699-fa84e3793b72",
					name: "Mockstore 1",
					//vectors: [],
					files: {},
					createdAt: new Date().toISOString()
				},
				"5e183876-8c00-47b3-a3ca-fbd2f063f399": {
					contextId: "5e183876-8c00-47b3-a3ca-fbd2f063f399",
					name: "Mockstore 2",
					//vectors: [],
					files: {},
					createdAt: new Date().toISOString()
				},
				"18b5c940-bfde-4bce-96e1-d486670da2b7": {
					contextId: "18b5c940-bfde-4bce-96e1-d486670da2b7",
					name: "Mockstore 3",
					//vectors: [],
					files: {},
					createdAt: new Date().toISOString()
				},
				"aa507f64-fa85-40d7-9884-16dd57e277b0": {
					contextId: "aa507f64-fa85-40d7-9884-16dd57e277b0",
					name: "Mockstore 4",
					//vectors: [],
					files: {},
					createdAt: new Date().toISOString()
				},
				"c6e45cfa-27d7-4d65-8b49-4eafe0691916": {
					contextId: "c6e45cfa-27d7-4d65-8b49-4eafe0691916",
					name: "Mockstore 5",
					//vectors: [],
					files: {},
					createdAt: new Date().toISOString()
				}
			}
		}

		return MockVectorStoreDb.contexts
	}

	private getChunkList(contextId: string): VectorChunk[]{
		if(!MockVectorStoreDb.chunks[contextId])
			return []
		return MockVectorStoreDb.chunks[contextId]
	}

	private ensureChunkList(contextId: string): VectorChunk[]{
		if(!MockVectorStoreDb.chunks[contextId]){
			MockVectorStoreDb.chunks[contextId] = []
		}
		return MockVectorStoreDb.chunks[contextId]		
	}


	private async addVectorMatrix(contextId: string, fileId: string, text: string, matrix: number[]) {
		const chunks = this.ensureChunkList(contextId)
		if (chunks) chunks.push({ text: text, vectorMatrix: matrix, fileId: fileId })
	}

	private async getVectorChunks(vectorContexts: string[]): Promise<VectorChunk[]> {
		const vectorChunks: VectorChunk[] = []
		for (const contextId of vectorContexts) {
			const chunks = this.getChunkList(contextId)
			if (chunks) {
				vectorChunks.push(...chunks)
			}
		}
		return vectorChunks
	}

	//__________________________________________________________________

	public async getContexts(): Promise<VectorContext[]> {
		const dictionary = this.getContextsDictionary()
		const contexts = Object.entries(dictionary).map((entry) => {
			return entry[1]
		})
		return contexts
	}

	public async getContext(contextId: string): Promise<VectorContext | null> {
		const contextDictionary = this.getContextsDictionary()
		if (!contextDictionary[contextId]) {
			return null
		}
		return contextDictionary[contextId]
	}

	public async createContext(config: CreateContextConfig): Promise<VectorContext> {
		// temporary hack. in the end we don't want to have userdefined id's I think.
		let id = config.id
		if (!id) id = crypto.randomUUID()

		const contextDictionary = this.getContextsDictionary()
		if (contextDictionary[id]) {
			return contextDictionary[id] as VectorContext
		}

		const timestamp = new Date().toISOString()
		const reply: VectorContext = { contextId: id, files: {}, name: config.name || `vectorStore_${Date.now().toString()}`, createdAt: timestamp }
		contextDictionary[reply.contextId] = reply
		return reply
	}

	public async addVectorChunks(context: string, chunks: VectorChunk[]) {
		const chunkList = this.ensureChunkList(context)
		if (chunkList) {
			chunks.forEach((chunk) => {
				chunkList.push(chunk)
			})
		}
	}

	public async addVectorData(context: string, fileId: string, texts: string[], matrixes: number[][]) {
		if (texts.length !== matrixes.length) {
			throw new Error("Vector texts and matrixes length does not match")
		}

		for (let i = 0; i < texts.length; i++) {
			this.addVectorMatrix(context, fileId, texts[i] as string, matrixes[i] as number[])
		}
	}

	public async makeFile(context: string, filename: string, bytes: number): Promise<VectorStoreFile> {
		const vectorContext = await this.getContext(context)
		if (!vectorContext || !vectorContext.files) throw new Error("Vector context not found")

		const fileId = crypto.randomUUID()
		const file: VectorStoreFile = { id: fileId, name: filename, type: "", bytes: bytes, status: "processing" /*regDate: new Date().toISOString()*/ }
		vectorContext.files[fileId] = file
		return file
	}

	public async getFiles(context: string): Promise<VectorStoreFile[]> {
		const vectorContext = await this.getContext(context)
		if (!vectorContext) return []

		return Object.entries(vectorContext.files).map(([_key, value]) => {
			return value
		})
	}
	public async removeFile(context: string, fileId: string): Promise<number> {
		const vectorContext = await this.getContext(context)
		if (!vectorContext) throw new Error("Context does not exist")
		const chunkList = this.getChunkList(context)
		const filteredVectors = chunkList.filter((chunk) => {
			return chunk.fileId !== fileId
		})
		const total = chunkList.length - filteredVectors.length // number of chunkcs we have removed
		MockVectorStoreDb.chunks[context] = filteredVectors
		return total
	}

	public async search(vectorContexts: string[], promptVector: number[]): Promise<string[]> {
		const vectorChunks = await this.getVectorChunks(vectorContexts)
		if (!vectorChunks || vectorChunks.length === 0) return []
		return (this.filterType === FilterType.Highest ? filterChunksHigest(promptVector, vectorChunks) : filterChunksTreshold(promptVector, vectorChunks)).map((val) => val.text)
	}
}

//-------------------
function filterChunksTreshold(promptVector: number[], vectorChunks: VectorChunk[], treshold: number = 0.5): VectorChunk[] {
	return vectorChunks.filter((chunk: VectorChunk) => {
		return cosineSimilarity(promptVector, chunk.vectorMatrix) >= treshold
	})
}

function filterChunksHigest(promptVector: number[], vectorChunks: VectorChunk[], cutoff: number = 2): VectorChunk[] {
	const tmp = vectorChunks
		.map((chunk: VectorChunk) => {
			return { score: cosineSimilarity(promptVector, chunk.vectorMatrix), chunk: chunk }
		})
		.sort((a, b) => {
			return b.score - a.score
		})
	return tmp.map((wrapper) => wrapper.chunk).slice(0, cutoff)
}

function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error("Vektorene må ha samme lengde!")
	}
	let dotProduct = 0
	let normA = 0
	let normB = 0
	for (let i = 0; i < a.length; i++) {
		const bn = b[i] || 0
		const an = a[i] || 0

		dotProduct += an * bn
		normA += an * an
		normB += bn * bn
	}
	if (normA === 0 || normB === 0) {
		return 0 // Unngå divisjon på null
	}
	return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
