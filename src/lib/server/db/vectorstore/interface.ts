import type { VectorChunk } from "$lib/types/vector"

export interface IVectorStore {
	addVectorMatrix(context:string, text: string, matrix: number[]): void
	getVectorChunks(vectorContexts: string[]): Promise<VectorChunk[]>
	addVectorData(context: string, texts: string[], matrixes: number[][]): void 
}
