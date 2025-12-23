import type { CreateContextConfig, VectorChunk, VectorContext } from "$lib/server/db/vectorstore/types"
import type { VectorStoreFile } from "$lib/types/vector-store"

export interface IVectorStoreDb {	
	getContexts(): Promise<VectorContext[]>
	getContext(id:string): Promise<VectorContext | null>
	createContext(config:CreateContextConfig): Promise<VectorContext>
	addVectorMatrix(context:string, fileId: string, text: string, matrix: number[]): void
	getVectorChunks(vectorContexts: string[]): Promise<VectorChunk[]>
	addVectorData(context: string, fileId: string, texts: string[], matrixes: number[][]): void
	makeFile(context: string, filename: string, bytes:number): Promise<VectorStoreFile>
	getFiles(context:string) : Promise<VectorStoreFile[]>
	removeFile(context: string, fileId:string) : Promise<number>
	search(vectorContexts: string[], queryVector: number[]): Promise<VectorChunk[]>
}
