import type { EmbedRequest } from "ollama";
import type { IEmbedder } from "./interface";
import { ollama } from "../ollama/ollama";

export class OllamaEmbedder implements IEmbedder {

	async embed(vectorStrings: string[]): Promise<number[][]> {
		const req: EmbedRequest = {
			model: 'embeddinggemma', //vendorInfo.models.supported.includes(this.dbAgent.config.model) ? this.dbAgent.config.model : vendorInfo.models.default,
			input: vectorStrings,
			truncate: false
		}
		const res = await ollama.embed(req)
		return res.embeddings
	}
	
}