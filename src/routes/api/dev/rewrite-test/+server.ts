import { json, type RequestHandler } from "@sveltejs/kit"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { rewriteRagQuery } from "$lib/server/ragservice/rag-query-rewrite"
import type { ChatRequest } from "$lib/types/chat"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

// TEMPORARY - lets us exercise the rewrite step (history -> standalone query, via the utility
// LLM) in isolation, without a real ragStoreId or ragservice call at all. Passing ragStoreIds: []
// makes rewriteRagQuery skip getRagStoreLanguages entirely, so this only ever touches the utility
// model/KI-server - useful for testing that path alone while ragservice itself is unreliable to
// reach locally. Delete this route once the feature is confirmed working end-to-end.
//
// POST body: { queryText: string, history?: { role: "user" | "assistant", text: string }[] }
const rewriteTest: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const body = (await requestEvent.request.json()) as { queryText?: string; history?: { role: "user" | "assistant"; text: string }[] }

	if (!body.queryText || typeof body.queryText !== "string") {
		throw new HTTPError(400, "queryText (string) is required")
	}

	const history = body.history ?? []

	const chatRequest: ChatRequest = {
		config: {
			_id: "rewrite-test",
			name: "rewrite-test",
			description: "rewrite-test",
			vendorId: "LITELLM",
			project: "DEFAULT",
			type: "private",
			accessGroups: [],
			created: { at: new Date().toISOString(), by: { id: "system" } },
			updated: { at: new Date().toISOString(), by: { id: "system" } }
		},
		inputs: [
			...history.map((h) =>
				h.role === "user"
					? { type: "message.input" as const, role: "user" as const, content: [{ type: "input_text" as const, text: h.text }] }
					: { id: crypto.randomUUID(), type: "message.output" as const, role: "assistant" as const, content: [{ type: "output_text" as const, text: h.text }] }
			),
			{
				type: "message.input",
				role: "user",
				content: [{ type: "input_text", text: body.queryText }]
			}
		],
		stream: false,
		store: false
	}

	const rewritten = await rewriteRagQuery({
		chatRequest,
		queryText: body.queryText,
		ragStoreIds: [],
		user,
		graphToken: null
	})

	return {
		isAuthorized: true,
		response: json({ original: body.queryText, rewritten })
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, rewriteTest)
}
