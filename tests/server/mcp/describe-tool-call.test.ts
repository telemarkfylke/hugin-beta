import { describe, expect, it } from "vitest"
import { describeToolCallForUser } from "../../../src/lib/server/mcp/describe-tool-call"

describe("describeToolCallForUser", () => {
	it("describes a folder-listing tool call by the folder it targets", () => {
		expect(describeToolCallForUser("List_SharePoint_Documents", '{"folder_name":"FLG-Referat"}')).toBe("Ser gjennom mappen «FLG-Referat»")
	})

	it("describes Get_SharePoint_Tree/List_SharePoint_Folders the same way, keyed off parent_folder", () => {
		expect(describeToolCallForUser("Get_SharePoint_Tree", '{"parent_folder":"General/Statistikk"}')).toBe("Ser gjennom mappen «General/Statistikk»")
		expect(describeToolCallForUser("List_SharePoint_Folders", '{"parent_folder":"General"}')).toBe("Ser gjennom mappen «General»")
	})

	it("falls back to a generic folder message when no folder argument is present", () => {
		expect(describeToolCallForUser("List_SharePoint_Documents", "{}")).toBe("Ser gjennom SharePoint-mapper")
	})

	it("describes a document-content/metadata call by the file name", () => {
		expect(describeToolCallForUser("Get_Document_Content", '{"folder_name":"FLG-Referat","file_name":"Kaiene i Kragerø.docx"}')).toBe("Henter dokumentet «Kaiene i Kragerø.docx»")
		expect(describeToolCallForUser("Get_File_Metadata", '{"folder_name":"FLG-Referat","file_name":"Referat 2026.pdf"}')).toBe("Henter dokumentet «Referat 2026.pdf»")
	})

	it("falls back to a generic document message when no file name is present", () => {
		expect(describeToolCallForUser("Get_Document_Content", "{}")).toBe("Henter et dokument")
	})

	it("describes a site-wide search call by the query", () => {
		expect(describeToolCallForUser("Search_SharePoint", '{"query":"digitalstrategien"}')).toBe("Søker i SharePoint etter «digitalstrategien»")
	})

	it("falls back to a generic search message when no query is present", () => {
		expect(describeToolCallForUser("Search_SharePoint", "{}")).toBe("Søker i SharePoint")
	})

	it("describes a SharePoint list-items call by the list name", () => {
		expect(describeToolCallForUser("Get_SharePoint_List_Items", '{"list_name":"AgendaCases"}')).toBe("Henter fra listen «AgendaCases»")
	})

	it("falls back to a generic list message when no list name is present", () => {
		expect(describeToolCallForUser("Get_SharePoint_List_Items", "{}")).toBe("Henter fra en SharePoint-liste")
	})

	it("describes a website browse call by the URL", () => {
		expect(describeToolCallForUser("browse_website", '{"url":"https://www.telemarkfylke.no/om-oss"}')).toBe("Leser nettsiden «https://www.telemarkfylke.no/om-oss»")
	})

	it("falls back to a generic tool message for an unrecognized tool name", () => {
		expect(describeToolCallForUser("Some_Future_Tool", '{"anything":"here"}')).toBe("Bruker et verktøy")
	})

	it("falls back gracefully when the arguments string is not valid JSON", () => {
		expect(describeToolCallForUser("List_SharePoint_Documents", "not json")).toBe("Ser gjennom SharePoint-mapper")
	})

	it("truncates a very long value rather than showing the whole thing", () => {
		const longQuery = "a".repeat(200)
		const description = describeToolCallForUser("Search_SharePoint", JSON.stringify({ query: longQuery }))
		expect(description.length).toBeLessThan(100)
		expect(description).toContain("…")
	})
})
