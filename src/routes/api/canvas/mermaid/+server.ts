import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canUseCanvas } from "$lib/authorization"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseMermaidRequest } from "$lib/validation/parse-mermaid-request"
import { extractTextOutput } from "./extract-text-output"

const MERMAID_VENDOR_ID = "OPENAI" as const
const MERMAID_MODEL = "gpt-5.6-terra"

const MERMAID_SYSTEM_PROMPT = `You are a Mermaid diagram generator. The user will give you the current Mermaid diagram source (may be empty) and a prompt describing what to create or change.
Apply the requested changes and return ONLY valid Mermaid diagram syntax — no explanations, no preamble, no markdown code fences around the output.

For well-known diagram types (flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, mindmap, journey, timeline) you already know the correct syntax.

Some newer diagram types use stricter, less familiar keyword-based syntax. Do not improvise or guess syntax for these — use exactly this structure:

venn-beta
set A ["Kunder"]
set B ["Abonnenter"]
set C ["Nyhetsbrev"]
union A,B ["Kunder med abonnement"]
union A,C ["Kunder som mottar nyhetsbrev"]
union B,C ["Abonnenter som mottar nyhetsbrev"]
union A,B,C ["Kunder med abonnement og nyhetsbrev"]
The overlap between two or more sets is always declared with the "union" keyword — never "intersection" or "overlap", even though the region it draws is the sets' intersection. "union" can list two or more set identifiers on one line.

To style a set or union's fill/border color, add a "style" line after the set/union declarations, e.g.:
style A fill:#E8F4FD, stroke:#0072B1
style B fill:#FDF0E8, stroke:#E06000
style A,B fill:#F9F0FF, stroke:#7B2D8B
A "style" line can target one set, or a comma-separated list of set identifiers to style their union region. If the user asks to color or style part of a Venn diagram, always add "style" lines like this — never silently ignore a styling request.

A venn-beta diagram must never have more than 3 sets. This is not a Mermaid restriction — it is a mathematical fact that circles cannot correctly represent all the overlaps among 4 or more sets (a 4th circle cannot intersect the other three in every way needed), so a 4-set Venn diagram is always visually broken regardless of how it is written. If the user asks for a Venn diagram with 4 or more categories, either merge the least important ones down to the 3 most important sets, or use a different diagram type (e.g. flowchart) that can clearly show 4+ categories and their relationships — whichever better preserves the user's intent. Never emit a venn-beta diagram with 4 or more "set" lines.

block-beta
columns 1
A
B["Middle Block"]
C
A --> B
B --> C

packet-beta
0-15: "Source Port"
16-31: "Destination Port"
32-47: "Length"

architecture-beta
service gateway(internet)[Gateway Label]
service server(server)[App Server]
gateway:B -- T:server

If the user asks for a diagram type not listed above and you are not certain of its exact syntax, prefer a well-known diagram type that can reasonably represent the same information instead of guessing at unfamiliar syntax.`

const mermaidHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!APP_CONFIG.CANVAS_ENABLED) {
		throw new HTTPError(404, "Canvas is not enabled")
	}
	if (!canUseCanvas(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use Canvas")
	}
	if (!APP_CONFIG.VENDORS.OPENAI.ENABLED) {
		throw new HTTPError(503, "Diagram is not available — OpenAI vendor is not configured")
	}

	const body = await requestEvent.request.json()
	const { diagram, prompt } = parseMermaidRequest(body)

	logger.info("[Canvas Mermaid] User {userId} submitting prompt (diagramLength: {diagramLength})", user.userId, diagram.length)

	const userMessage = diagram ? `Here is the current Mermaid diagram source:\n\n${diagram}\n\n---\n\nUser instruction: ${prompt}` : prompt

	const vendor = getVendor(MERMAID_VENDOR_ID)
	const response = await vendor.createChatResponse({
		config: {
			_id: "",
			name: "Canvas Mermaid",
			description: "",
			vendorId: MERMAID_VENDOR_ID,
			project: "DEFAULT",
			model: MERMAID_MODEL,
			accessGroups: ["all"],
			type: "private",
			created: { at: "", by: { id: "" } },
			updated: { at: "", by: { id: "" } },
			instructions: MERMAID_SYSTEM_PROMPT
		},
		inputs: [
			{
				type: "message.input",
				role: "user",
				content: [{ type: "input_text", text: userMessage }]
			}
		],
		stream: false
	})

	const text = extractTextOutput(response.outputs)

	if (!text.trim()) {
		throw new HTTPError(502, "Fikk ikke gyldig diagram fra modellen")
	}

	return { isAuthorized: true, response: json({ diagram: text }) }
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, mermaidHandler)
}
