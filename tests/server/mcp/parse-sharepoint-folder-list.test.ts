import { describe, expect, it } from "vitest"
import { parseFolderList } from "../../../src/lib/server/mcp/parse-sharepoint-folder-list"

describe("parseFolderList", () => {
	it("parses a single bare object - the verified real shape for a one-match folder", () => {
		const text = JSON.stringify({
			name: "Kapish",
			url: "https://telemarkfylke.sharepoint.com/sites/TJssharepointverksted/Delte%20dokumenter/Ruens%20hj%C3%B8rne/Trudelutt/Kapish",
			created: "2026-09-10T09:26:08Z",
			modified: "2026-09-10T09:26:08Z"
		})
		const folders = parseFolderList(text, "Ruens hjørne/Trudelutt")
		expect(folders).toEqual([{ name: "Kapish", path: "Ruens hjørne/Trudelutt/Kapish" }])
	})

	it("parses a proper JSON array of objects", () => {
		const text = JSON.stringify([{ name: "A" }, { name: "B" }])
		const folders = parseFolderList(text, "")
		expect(folders).toEqual([
			{ name: "A", path: "A" },
			{ name: "B", path: "B" }
		])
	})

	it("parses an object wrapped under a result/folders/items key, if the server ever does that", () => {
		expect(parseFolderList(JSON.stringify({ result: [{ name: "A" }] }), "")).toEqual([{ name: "A", path: "A" }])
		expect(parseFolderList(JSON.stringify({ folders: [{ name: "A" }] }), "")).toEqual([{ name: "A", path: "A" }])
		expect(parseFolderList(JSON.stringify({ items: [{ name: "A" }] }), "")).toEqual([{ name: "A", path: "A" }])
	})

	it("falls back to splitting multiple bare objects concatenated with no separator", () => {
		const text = `${JSON.stringify({ name: "A" })}${JSON.stringify({ name: "B" })}`
		const folders = parseFolderList(text, "Parent")
		expect(folders).toEqual([
			{ name: "A", path: "Parent/A" },
			{ name: "B", path: "Parent/B" }
		])
	})

	it("handles a name containing braces inside a string value without miscounting depth", () => {
		const text = `${JSON.stringify({ name: "A", note: "{not a boundary}" })}${JSON.stringify({ name: "B" })}`
		const folders = parseFolderList(text, "")
		expect(folders.map((f) => f.name)).toEqual(["A", "B"])
	})

	it("returns an empty list for unparseable garbage rather than throwing", () => {
		expect(parseFolderList("not json at all", "")).toEqual([])
	})

	it("builds the path from parentFolder + name when the item has no path/url field to use instead", () => {
		const folders = parseFolderList(JSON.stringify({ name: "Sub" }), "Top/Mid")
		expect(folders).toEqual([{ name: "Sub", path: "Top/Mid/Sub" }])
	})
})
