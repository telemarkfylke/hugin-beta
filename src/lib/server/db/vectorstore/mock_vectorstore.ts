import type { VectorChunk } from "$lib/types/vector";
import type { IVectorStore } from "./interface";


export class MockVectorStore implements IVectorStore {
	static vectors: Record<string, VectorChunk[]> = {}

	constructor() {

	}

	private getVectors(): Record<string, VectorChunk[]> {
		if (!MockVectorStore.vectors) {
			MockVectorStore.vectors = {}
		}
		return MockVectorStore.vectors
	}

	private getContextVectorChunks(context: string): VectorChunk[] {
		const vectors = this.getVectors()
		if (!vectors[context]) {
			vectors[context] = []
		}
		return vectors[context]
	}
	//__________________________________________________________________

	public async addVectorMatrix(context: string, text: string, matrix: number[]) {
		const vectorContext = this.getContextVectorChunks(context)
		vectorContext.push({ text: text, vectorMatrix: matrix })
	}

	public async addVectorChunks(context: string, chunks: VectorChunk[]) {
		const vectorContext = this.getContextVectorChunks(context)
		chunks.forEach((chunk) => {
			vectorContext.push(chunk)
		})
	}

	public async addVectorData(context: string, texts: string[], matrixes: number[][]) {
		if (texts.length !== matrixes.length) {
			throw new Error('Vector texts and matrixes length does not match')
		}

		for (let i = 0; i < texts.length; i++) {
			// Burde være unødvendig å caste her. Det skal ikke kunne være undefined her, men.. kompilatoren har liten bart
			this.addVectorMatrix(context, texts[i] as string, matrixes[i] as number[])
		}
	}

	public async getVectorChunks(vectorContexts: string[]): Promise<VectorChunk[]> {
		const vectorChunks: VectorChunk[] = []
		for (const context of vectorContexts) {
			const chuncks = this.getContextVectorChunks(context)
			vectorChunks.push(...chuncks)
		}
		return vectorChunks
	}
}