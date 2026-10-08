import { tryParseJson } from "./parse-tool-result-items"
import { extractFolderArg, extractListNameArg } from "./scoped-sharepoint-client"

// Turns a tool call's raw name + JSON arguments into a short, human-readable status line (shown in
// place of the previous generic "Søker på nettet..." while an MCP/website tool call is in flight -
// see chat-response-builder.ts's response.tool_call case and ChatHistoryItem.svelte). Every branch
// falls back to a still-useful generic message rather than showing nothing/raw JSON, since the
// model's arguments aren't guaranteed to be present or well-formed (a malformed tool call is fed
// back to the model as an error by agentic-loop.ts, but the SSE status shown while it's in flight
// still needs to say something reasonable).
const MAX_VALUE_LENGTH = 60

const truncate = (value: string): string => (value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH - 1)}…` : value)

const parseArgs = (argumentsJson: string): Record<string, unknown> => {
	const parsed = tryParseJson(argumentsJson)
	return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
}

const stringArg = (args: Record<string, unknown>, key: string): string | undefined => {
	const value = args[key]
	return typeof value === "string" ? value : undefined
}

export const describeToolCallForUser = (toolName: string, argumentsJson: string): string => {
	const args = parseArgs(argumentsJson)

	switch (toolName) {
		case "Search_SharePoint": {
			const query = stringArg(args, "query")
			return query ? `Søker i SharePoint etter «${truncate(query)}»` : "Søker i SharePoint"
		}
		case "Get_Document_Content":
		case "Get_File_Metadata": {
			const fileName = stringArg(args, "file_name")
			return fileName ? `Henter dokumentet «${truncate(fileName)}»` : "Henter et dokument"
		}
		case "List_SharePoint_Documents":
		case "Get_SharePoint_Tree":
		case "List_SharePoint_Folders": {
			const folder = extractFolderArg(args)
			return folder ? `Ser gjennom mappen «${truncate(folder)}»` : "Ser gjennom SharePoint-mapper"
		}
		case "Get_SharePoint_List_Items": {
			const listName = extractListNameArg(args)
			return listName ? `Henter fra listen «${truncate(listName)}»` : "Henter fra en SharePoint-liste"
		}
		case "browse_website": {
			const url = stringArg(args, "url")
			return url ? `Leser nettsiden «${truncate(url)}»` : "Leser en nettside"
		}
		default:
			return "Bruker et verktøy"
	}
}
