import type { CreateContextConfig, VectorChunk, VectorContext } from "$lib/server/db/vectorstore/types";
import type { VectorStoreFile } from "$lib/types/vector-store";
import type { IVectorStoreDb } from "./interface";

export class MongoVectorStoreDb implements IVectorStoreDb {

	static contexts: Record<string, VectorContext> = {}
	static vectors: Record<string, VectorChunk[]> = {}
	static files: Record<string, VectorStoreFile> = {}

	constructor() {
	}

	getContexts(): Promise<VectorContext[]> {
		throw new Error("Method not implemented.");
	}

	getContext(_id: string): Promise<VectorContext | null> {
		throw new Error("Method not implemented.");
	}

	createContext(_config: CreateContextConfig): Promise<VectorContext> {
		throw new Error("Method not implemented.");
	}

	makeFile(_context: string, _filename: string, _bytes: number): Promise<VectorStoreFile> {
		throw new Error("Method not implemented.");
	}

	getFiles(_context: string): Promise<VectorStoreFile[]> {
		throw new Error("Method not implemented.");
	}
	removeFile(_context: string, _fileId: string): Promise<number> {
		throw new Error("Method not implemented.");
	}

	addVectorMatrix(_context: string, _fileId: string, _text: string, _matrix: number[]): void {
		throw new Error("Method not implemented.");
	}

	getVectorChunks(_context: string[]): Promise<VectorChunk[]> {
		throw new Error("Method not implemented.");
	}

	addVectorData(_context: string, _fileId: string, _texts: string[], _matrixes: number[][]): void {
		throw new Error("Method not implemented.");
	}

	search(_vectorContexts: string[], _queryVector: number[]): Promise<VectorChunk[]> {
		throw new Error("Method not implemented.");
	}
}

