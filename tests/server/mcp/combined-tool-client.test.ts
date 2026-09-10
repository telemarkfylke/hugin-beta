import { describe, expect, it, vi } from "vitest"
import { createCombinedToolClient } from "../../../src/lib/server/mcp/combined-tool-client"
import type { McpClient } from "../../../src/lib/server/mcp/mcp-client"

const makeClient = (toolName: string): McpClient => ({
	listTools: vi.fn().mockResolvedValue([{ name: toolName, description: "", inputSchema: {} }]),
	callTool: vi.fn().mockResolvedValue(`result from ${toolName}`)
})

describe("createCombinedToolClient", () => {
	it("listTools returns the union of every client's tools", async () => {
		const sharepointClient = makeClient("List_SharePoint_Folders")
		const websiteClient = makeClient("browse_website")
		const combined = createCombinedToolClient([sharepointClient, websiteClient])

		const tools = await combined.listTools()

		expect(tools.map((t) => t.name).sort()).toEqual(["List_SharePoint_Folders", "browse_website"])
	})

	it("dispatches callTool to whichever client actually owns that tool name", async () => {
		const sharepointClient = makeClient("List_SharePoint_Folders")
		const websiteClient = makeClient("browse_website")
		const combined = createCombinedToolClient([sharepointClient, websiteClient])

		await combined.listTools() // populates the name->client lookup

		const result = await combined.callTool("browse_website", { url: "https://example.no" })

		expect(result).toBe("result from browse_website")
		expect(websiteClient.callTool).toHaveBeenCalledWith("browse_website", { url: "https://example.no" })
		expect(sharepointClient.callTool).not.toHaveBeenCalled()
	})

	it("throws for a tool name no client owns", async () => {
		const combined = createCombinedToolClient([makeClient("List_SharePoint_Folders")])
		await combined.listTools()

		await expect(combined.callTool("unknown_tool", {})).rejects.toThrow()
	})
})
