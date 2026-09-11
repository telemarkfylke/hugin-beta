import { describe, expect, it } from "vitest"
import { parseListNames } from "../../../src/lib/server/mcp/parse-sharepoint-list-names"

describe("parseListNames", () => {
	it("parses a result-wrapped array of objects using the 'title' field (SharePoint's own convention for a list's display name)", () => {
		const text = JSON.stringify({ result: [{ title: "Programmer" }, { title: "Budsjettposter" }] })
		expect(parseListNames(text)).toEqual(["Programmer", "Budsjettposter"])
	})

	it("falls back to 'name' when 'title' is absent", () => {
		const text = JSON.stringify({ result: [{ name: "Programmer" }] })
		expect(parseListNames(text)).toEqual(["Programmer"])
	})

	it("falls back to 'displayName' when neither 'title' nor 'name' is present", () => {
		const text = JSON.stringify({ result: [{ displayName: "Programmer" }] })
		expect(parseListNames(text)).toEqual(["Programmer"])
	})

	it("parses a bare JSON array directly, without a result wrapper", () => {
		const text = JSON.stringify([{ title: "Programmer" }])
		expect(parseListNames(text)).toEqual(["Programmer"])
	})

	it("accepts a bare string item as a name directly", () => {
		const text = JSON.stringify(["Programmer", "Budsjettposter"])
		expect(parseListNames(text)).toEqual(["Programmer", "Budsjettposter"])
	})

	it("skips an item with no recognizable name field, rather than guessing", () => {
		const text = JSON.stringify({ result: [{ id: "123" }, { title: "Programmer" }] })
		expect(parseListNames(text)).toEqual(["Programmer"])
	})

	it("dedupes identical names", () => {
		const text = JSON.stringify({ result: [{ title: "Programmer" }, { title: "Programmer" }] })
		expect(parseListNames(text)).toEqual(["Programmer"])
	})

	it("returns an empty list for unparseable garbage rather than throwing", () => {
		expect(parseListNames("not json at all")).toEqual([])
	})
})
