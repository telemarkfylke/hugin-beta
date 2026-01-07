import { env } from "$env/dynamic/private"
import type { IVectorStoreDb } from "../db/vectorstore/interface"
import { MockVectorStoreDb } from "../db/vectorstore/mock_vectorstore"
import { MongoVectorStoreDb } from "../db/vectorstore/mongodb_vectorstore"
import type { IEmbedder } from "../embeddings/interface"
import { MockEmbedder } from "../embeddings/mock_embedder"
import { OllamaEmbedder } from "../embeddings/ollama_embedder"

export type IocContainer = {
	vectorStore: IVectorStoreDb
	embedder: IEmbedder
}

let iocContainer: IocContainer

export function getIocContainer() {
	if (!iocContainer) {
		iocContainer = {
			vectorStore: env.MOCK_VECTORSTORE === "true" ? new MockVectorStoreDb() : new MongoVectorStoreDb(),
			embedder: env.MOCK_EMBEDDER === "true" ? new MockEmbedder() : new OllamaEmbedder()
		}
	}

	return iocContainer
}

export function setIocContainer(container: IocContainer) {
	iocContainer = container
}
