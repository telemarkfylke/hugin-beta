export interface IEmbedder {
	embedMultiple(vectorStrings: string[]): Promise<number[][]>
	embedSingle(vectorStrings: string): Promise<number[]>
}
