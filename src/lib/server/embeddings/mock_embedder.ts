import type { IEmbedder } from "./interface";

export class MockEmbedder implements IEmbedder {
	embedSingle(_vectorStrings: string): Promise<number[]> {
		throw new Error("Method not implemented.");
	}
	async embedMultiple(_vectorStrings: string[]): Promise<number[][]> {
		const res: number[][] = [[67.5],[-23.2],[24.0],[-24]]		
		return res
	}
}