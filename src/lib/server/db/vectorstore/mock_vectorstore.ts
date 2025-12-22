import type { VectorChunk, VectorContext } from "$lib/server/db/vectorstore/types";
import type { VectorStoreFile } from "$lib/types/vector-store";
import type { IVectorStore } from "./interface";


export class MockVectorStore implements IVectorStore {

	static contexts: Record<string, VectorContext> = {}

	constructor() {

	}

	private getContexts(): Record<string, VectorContext> {
		if (!MockVectorStore.contexts) {
			MockVectorStore.contexts = {}
		}

		return MockVectorStore.contexts
	}


	//__________________________________________________________________
	public async getContext(contextId: string): Promise<VectorContext | null> {
		const contextDictionary = this.getContexts()
		if (!contextDictionary[contextId]) {
			return null
		}
		return contextDictionary[contextId]
	}

	public async createContext(id?: string): Promise<VectorContext> {
		if (!id)
			id = crypto.randomUUID()

		const contextDictionary = this.getContexts()
		if (contextDictionary[id]) {
			return contextDictionary[id] as VectorContext
		}

		const reply: VectorContext = { contextId: id, vectors: [], files: {} }
		contextDictionary[reply.contextId] = { contextId: id, vectors: [], files: {} }
		return reply
	}

	public async addVectorMatrix(contextId: string, fileId: string, text: string, matrix: number[]) {
		const vectorContext = await this.getContext(contextId)
		if (vectorContext)
			vectorContext.vectors.push({ text: text, vectorMatrix: matrix, fileId: fileId })
	}

	public async addVectorChunks(context: string, chunks: VectorChunk[]) {
		const vectorContext = await this.getContext(context)
		if (vectorContext) {
			chunks.forEach((chunk) => {
				vectorContext.vectors.push(chunk)
			})
		}
	}

	public async addVectorData(context: string, fileId: string, texts: string[], matrixes: number[][]) {
		if (texts.length !== matrixes.length) {
			throw new Error('Vector texts and matrixes length does not match')
		}

		for (let i = 0; i < texts.length; i++) {
			// Burde være unødvendig å caste her. Det skal ikke kunne være undefined her, men.. kompilatoren har liten bart
			this.addVectorMatrix(context, fileId, texts[i] as string, matrixes[i] as number[])
		}
	}

	public async getVectorChunks(vectorContexts: string[]): Promise<VectorChunk[]> {
		const vectorChunks: VectorChunk[] = []
		for (const contextId of vectorContexts) {
			const vectorContext = await this.getContext(contextId)
			if (vectorContext) {
				vectorChunks.push(...vectorContext?.vectors)
			}
		}
		return vectorChunks
	}

	public async makeFile(context: string, filename: string, bytes: number): Promise<VectorStoreFile> {
		const vectorContext = await this.getContext(context)
		if (!vectorContext || !vectorContext.files)
			throw new Error('Vector context not found')

		const fileId = crypto.randomUUID()
		const file: VectorStoreFile = { id: fileId, name: filename, type: '', bytes: bytes, status: 'processing' /*regDate: new Date().toISOString()*/ }
		vectorContext.files[fileId] = file
		return file
	}

	public async getFiles(context: string): Promise<VectorStoreFile[]> {
		const vectorContext = await this.getContext(context)
		if (!vectorContext)
			return []

		return Object.entries(vectorContext.files).map(([_key, value]) => {
			return value
		})

	}
	public async removeFile(context: string, fileId: string): Promise<number> {
		const vectorContext = await this.getContext(context)
		if (!vectorContext)
			throw new Error("Context doies not exist")
		let total = 0;
		const filteredVectors = vectorContext.vectors.filter((chunk) => {
			chunk.fileId !== fileId
			total++
		})
		vectorContext.vectors = filteredVectors
		return total
	}
}