import type { EmbedRequest } from "ollama";
import type { IEmbedder } from "./interface";
import { ollama } from "../ollama/ollama";

export class OllamaEmbedder implements IEmbedder {
	async embedSingle(vectorStrings: string): Promise<number[]> {
		const req: EmbedRequest = {
			model: 'embeddinggemma', 
			input: vectorStrings,
			truncate: false
		}
		const res = await ollama.embed(req)
		if(res.embeddings.length > 0)
			return res.embeddings[0] || []

		return []
	}

	async embedMultiple(vectorStrings: string[]): Promise<number[][]> {
		const req: EmbedRequest = {
			model: 'embeddinggemma', 
			input: vectorStrings,
			truncate: false
		}
		const res = await ollama.embed(req)
		return res.embeddings
	}
	
}