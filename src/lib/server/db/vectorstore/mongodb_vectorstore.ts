import type { VectorChunk, VectorContext } from "$lib/server/db/vectorstore/types";
import type { VectorStoreFile } from "$lib/types/vector-store";
import type { IVectorStore } from "./interface";

export class MongoDbVectorStore implements IVectorStore {

	static contexts: Record<string, VectorContext> = {}
	static vectors: Record<string, VectorChunk[]> = {}
	static files: Record<string, VectorStoreFile> = {}

	constructor() {
	}
	getContext(id: string): Promise<VectorContext | null> {
		throw new Error("Method not implemented.");
	}
	createContext(id?:string): Promise<VectorContext> {
		throw new Error("Method not implemented.");
	}
	makeFile(_context: string, _filename: string, _bytes:number): Promise<VectorStoreFile> {
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
}

