import type { VectorChunk } from "$lib/server/db/vectorstore/types"

export interface IEmbedder {
	embed(vectorStrings: string[]): Promise<number[][]>
}
