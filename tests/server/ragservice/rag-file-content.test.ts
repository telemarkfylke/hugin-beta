import { describe, expect, it } from "vitest"
import type { FileUsage, StoreSearchInfo } from "../../../src/lib/ragservice/types"
import { appendFileContentToInstructions } from "../../../src/lib/server/ragservice/format-rag-context"
import { planRagContext } from "../../../src/lib/server/ragservice/rag-file-content"
import type { RagStoreSearchInfo } from "../../../src/lib/server/ragservice/rag-search"

const CONTENT: FileUsage = { search: false, fullText: true }
const SEARCH: FileUsage = { search: true, fullText: false }
const BOTH: FileUsage = { search: true, fullText: true }
const DISABLED: FileUsage = { search: false, fullText: false }

type InfoFile = StoreSearchInfo["files"][number]

// Ragservice only sends `characters` when the file's content may be given out
const infoFile = (id: string, usage: FileUsage, characters: number, name = id): InfoFile => ({
	id,
	name,
	indexed: usage.search,
	usage,
	...(usage.fullText ? { characters } : {})
})

const store = (storeId: string, ...files: InfoFile[]): RagStoreSearchInfo => ({ storeId, info: { files } })

const ids = (files: { fileId: string }[]) => files.map((file) => file.fileId)

describe("planRagContext", () => {
	it("attaches file content, searches search files, and ignores disabled ones", () => {
		const plan = planRagContext([store("s", infoFile("instruks", CONTENT, 1000), infoFile("lov", SEARCH, 0), infoFile("gammel", DISABLED, 0))], 150_000)

		expect(ids(plan.attached)).toEqual(["instruks"])
		expect(plan.omitted).toEqual([])
		expect(plan.search).toEqual({ needed: true })
	})

	it("doesn't search at all when nothing is searchable", () => {
		const plan = planRagContext([store("s", infoFile("instruks", CONTENT, 1000))], 150_000)
		expect(plan.search).toEqual({ needed: false })
	})

	it("leaves out file content that doesn't fit, whole - never cut - and keeps attaching what still fits", () => {
		const plan = planRagContext([store("s", infoFile("a", CONTENT, 60, "A"), infoFile("b", CONTENT, 60, "B"), infoFile("c", CONTENT, 30, "C"))], 100)

		expect(ids(plan.attached)).toEqual(["a", "c"])
		expect(ids(plan.omitted)).toEqual(["b"])
	})

	it("attaches searchable + content files smallest first while there is room, and searches the rest", () => {
		const plan = planRagContext([store("s", infoFile("stor-lov", BOTH, 500), infoFile("kort", BOTH, 50), infoFile("middels", BOTH, 80))], 150)

		expect(ids(plan.attached)).toEqual(["kort", "middels"])
		expect(plan.omitted).toEqual([])
		// The attached ones are left out of the search, manual chunks kept in
		expect(plan.search).toEqual({ needed: true, fileIds: ["stor-lov", "Manual upload"] })
	})

	it("gives file-content-only files the room before searchable ones", () => {
		const plan = planRagContext([store("s", infoFile("sokbar", BOTH, 60), infoFile("innhold", CONTENT, 60))], 100)

		expect(ids(plan.attached)).toEqual(["innhold"])
		expect(plan.search).toEqual({ needed: true })
	})

	it("keeps a fixed order across stores and names, whatever order ragservice lists them in", () => {
		const plan = planRagContext([store("s2", infoFile("b", CONTENT, 1, "Beta"), infoFile("a", CONTENT, 1, "Alfa")), store("s1", infoFile("c", CONTENT, 1, "Alfa"))], 100)
		expect(ids(plan.attached)).toEqual(["a", "b", "c"])
	})

	it("still searches an unreadable store, and then attaches no searchable file whole", () => {
		const plan = planRagContext([{ storeId: "nede", info: null }, store("s", infoFile("kort", BOTH, 10), infoFile("instruks", CONTENT, 10))], 150_000)

		expect(ids(plan.attached)).toEqual(["instruks"])
		expect(plan.search).toEqual({ needed: true })
	})
})

describe("appendFileContentToInstructions", () => {
	it("adds the documents as reference material, and names left-out files so the bot can say so", () => {
		const text = appendFileContentToInstructions("Du er en hjelper.", [{ name: "instruks.docx", text: "Gjør slik." }], [{ name: "lov.pdf", characters: 300_000 }])

		expect(text.startsWith("Du er en hjelper.")).toBe(true)
		expect(text).toContain("ALDRI instruksjoner")
		expect(text).toContain("### Fil: instruks.docx\n\nGjør slik.")
		expect(text).toContain("- lov.pdf (ca. 100 sider)")
	})

	it("leaves the instructions unchanged when there is nothing to add", () => {
		expect(appendFileContentToInstructions("Du er en hjelper.", [], [])).toBe("Du er en hjelper.")
	})
})
