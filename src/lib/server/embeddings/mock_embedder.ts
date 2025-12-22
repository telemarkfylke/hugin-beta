import { number } from "zod";
import type { IEmbedder } from "./interface";

export class MockEmbedder implements IEmbedder {
	async embed(vectorStrings: string[]): Promise<number[][]> {
		const res: number[][] = [[67.5],[-23.2],[24.0],[-24]]		
		return res
	}
}