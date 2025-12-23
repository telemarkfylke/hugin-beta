import { VectorChunk, type VectorContext } from "$lib/server/db/vectorstore/types";
import type { VectorStore } from "$lib/types/vector-store";

// Dette er en måte å splitte på, vi bør eksprimentere litt med forskjellig chunking
export function splitToChuncks(text: string): string[] {
	return text.split('#').filter((part: string) => { return part != '' }).map((text: string) => { return text.toLowerCase() /*.replaceAll('\r\n','. ')*/ })
}

export async function filesToChunks(files: File[], result?: string[]): Promise<string[]> {
	if (!result) result = []
	for (const file of files) {
		const text = await file.text()
		result.push(...splitToChuncks(text))
	}
	return result
}

export async function fileToChunks(file: File, result?: string[]): Promise<string[]> {
	if (!result) result = []
	const text = await file.text()
	result.push(...splitToChuncks(text))
	return result
}


export const mapVectorContextToVectorStore = (context: VectorContext, vendor: "ollama" | "mock-ai"): VectorStore => {
	return {
		id: context.contextId,
		vendorId: vendor,
		name: context.name,
		// @ts-expect-error SDK mangler description på typene sine, jeg vil se om den er der
		description: openAIVectorStore.description || "",
		generatedDescription: "",
		createdAt: new Date(context.createdAt).toISOString(),
		numberOfFiles: Object.values(context.files).length,
		totalBytes: 0,
		updatedAt: null
	}
}
