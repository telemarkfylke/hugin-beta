import { VectorChunk } from "$lib/types/vector";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vektorene må ha samme lengde!");
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
		const bn = b[i] || 0
		const an = a[i] || 0

    dotProduct += an * bn;
    normA += an * an;
    normB += bn * bn;
  }
  if (normA === 0 || normB === 0) {
    return 0; // Unngå divisjon på null
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Dette er en måte å splitte på, vi bør eksprimentere litt med forskjellig chunking
export function splitToChuncks(text: string): string[]{
	return text.split('#').filter((part: string) => { return part != '' }).map((text: string) => { return text.toLowerCase() /*.replaceAll('\r\n','. ')*/ })
}

export async function filesToChunks(files: File[], result?: string[]): Promise<string[]> {
	if(!result) result = []
	for (const file of files) {
		const text = await file.text()
		result.push(...splitToChuncks(text))
	}
	return result
}

export function filterChunks(promptVector:number[], vectorChunks: VectorChunk[], treshold:number = 0.5): string[]{
	return vectorChunks.filter((chunk:VectorChunk) => {
		return cosineSimilarity(promptVector, chunk.vectorMatrix) >= treshold
	}).map((chunk) => chunk.text)
}

export function filterChunksHigest(promptVector:number[], vectorChunks: VectorChunk[], cutoff:number = 2): string[]{
	const tmp = vectorChunks.map((chunk:VectorChunk) => {
		return { score: cosineSimilarity(promptVector, chunk.vectorMatrix), text:chunk.text }
	}).sort((a, b) => {
			return b.score - a.score
	})

	return tmp.map((chunk) => chunk.text).slice(0, cutoff)
}