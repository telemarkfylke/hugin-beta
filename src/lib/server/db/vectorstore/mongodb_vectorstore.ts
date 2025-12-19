import type { VectorChunk } from "$lib/types/vector";
import type { IVectorStore } from "./interface";

export class MongoDbVectorStore implements IVectorStore {
	static vectors: Record<string, VectorChunk[]> = {}

	constructor() {
	}	
	getCombinedChunks(vectorContexts: string[]): Promise<VectorChunk[]> {
		throw new Error("Method not implemented.");
	}
	
	addVectorMatrix(_context: string, _text: string, matrix: number[]): void {
		throw new Error("Method not implemented.");
	}

	getVectorChunks(_context: string[]): Promise<VectorChunk[]> {
		throw new Error("Method not implemented.");
	}

	addVectorData(_context: string, _texts: string[], _matrixes: number[][]): void {
		throw new Error("Method not implemented.");
	}
}

