import { describe, expect, it } from "vitest"
import { approximatePages, FILE_USAGE_CHOICES, fileUsage, isFileIndexed, usageChoice, usageChoiceBlocker } from "../../../src/lib/ragservice/file-usage"
import type { VectorStoreFile } from "../../../src/lib/ragservice/types"

const file = (overrides: Partial<VectorStoreFile> = {}): VectorStoreFile => ({
	id: "f",
	name: "lov.pdf",
	type: "",
	bytes: 1,
	status: "Done",
	usage: { search: false, fullText: true },
	original: { contentType: "application/pdf", bytes: 1 },
	text: { characters: 9000 },
	indexed: false,
	...overrides
})

// An old file: the fields are absent, not set to undefined (exactOptionalPropertyTypes)
const without = (f: VectorStoreFile, ...keys: (keyof VectorStoreFile)[]): VectorStoreFile => {
	const copy = { ...f }
	for (const key of keys) delete copy[key]
	return copy
}

const usageOf = (choice: string) => {
	const option = FILE_USAGE_CHOICES.find((c) => c.choice === choice)
	if (!option) throw new Error(`No choice ${choice}`)
	return option.usage
}

describe("usageChoice", () => {
	it("maps every usage back to its own choice", () => {
		for (const { choice, usage } of FILE_USAGE_CHOICES) expect(usageChoice(usage)).toBe(choice)
	})
})

describe("isFileIndexed", () => {
	it("follows the indexed field, and counts old files without one as indexed once done", () => {
		expect(isFileIndexed(file({ indexed: { chunks: 3 } }))).toBe(true)
		expect(isFileIndexed(file({ indexed: false }))).toBe(false)
		expect(isFileIndexed(without(file({ status: "Done" }), "indexed"))).toBe(true)
		expect(isFileIndexed(without(file({ status: "Embedding" }), "indexed"))).toBe(false)
	})
})

describe("usageChoiceBlocker", () => {
	it("allows disabled and file content on a stored, unindexed file, but not the search choices", () => {
		const stored = file()
		expect(usageChoiceBlocker(stored, usageOf("disabled"))).toBeNull()
		expect(usageChoiceBlocker(stored, usageOf("content"))).toBeNull()
		expect(usageChoiceBlocker(stored, usageOf("search"))).toBe("Indekser filen først")
		expect(usageChoiceBlocker(stored, usageOf("searchAndContent"))).toBe("Indekser filen først")
	})

	it("allows every choice on an indexed file with stored text", () => {
		const indexed = file({ indexed: { chunks: 3 } })
		for (const { usage } of FILE_USAGE_CHOICES) expect(usageChoiceBlocker(indexed, usage)).toBeNull()
	})

	it("blocks file content on an old file without original", () => {
		const legacy = without(file(), "original", "text", "indexed")
		expect(usageChoiceBlocker(legacy, usageOf("search"))).toBeNull()
		expect(usageChoiceBlocker(legacy, usageOf("content"))).toMatch(/Originalen mangler/)
	})
})

describe("approximatePages", () => {
	it("rounds to whole pages and never says zero", () => {
		expect(approximatePages(9000)).toBe(3)
		expect(approximatePages(100)).toBe(1)
	})
})

describe("fileUsage", () => {
	it("uses ragservice's usage, and the old-file default when an older ragservice sends none", () => {
		expect(fileUsage(file({ usage: { search: true, fullText: true } }))).toEqual({ search: true, fullText: true })
		expect(fileUsage(without(file({ status: "Done" }), "usage", "indexed"))).toEqual({ search: true, fullText: false })
	})
})
