import { logger } from "@vestfoldfylke/loglady"
import { buildUtilityConfig, createUtilityChatResponse } from "$lib/server/utility-llm"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatRequest } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessage } from "$lib/types/chat-item"
import type { InputText, OutputText } from "$lib/types/chat-item-content"
import { getRagStoreLanguages, type RagStoreLanguages } from "./rag-search"

// How many prior turns (user + assistant) to feed the rewrite model as context. Enough to
// resolve a pronoun/reference from the last couple of exchanges without ballooning the prompt.
const MAX_HISTORY_ITEMS = 10

const REWRITE_SYSTEM_PROMPT = `Du hjelper til med å omskrive brukerens siste spørsmål til et frittstående søk som skal sendes til et RAG-søk (retrieval) mot en kunnskapsbase.

Gjør dette i rekkefølge:
1. Finn ut nøyaktig hva pronomen og uklare referanser i spørsmålet peker på (f.eks. "han", "det", "den", "der", "they", "them", "it"), ved å se i samtalehistorikken. Gjør dette UANSETT hvilket språk spørsmålet er skrevet på - selv om spørsmålet er på et annet språk enn historikken, skal du fortsatt finne og bruke de konkrete navnene/detaljene fra historikken. Ikke hopp over dette steget.
2. Skriv et nytt, frittstående søk som inkluderer de konkrete navnene/detaljene du fant i steg 1, slik at søket gir mening helt uten kontekst.
3. Hvis kunnskapsbasen hovedsakelig inneholder tekst på et annet språk enn spørsmålet, skriv søket fra steg 2 på det språket i stedet - men behold alltid navnene/detaljene fra steg 1, de skal ALDRI mistes underveis.

Eksempel: Historikken nevner "Johan Olav Koss" og "kong Harald". Spørsmålet er "who is oldest?". Riktig omskrevet søk: "Hvem er eldst, Johan Olav Koss eller kong Harald?". Feil (mister konteksten fra historikken): "Hvilken person er eldst?".

Andre regler:
- Skriv søket som en naturlig, fullstendig setning eller spørsmål - IKKE som en stikkordliste eller med VERSALER. Eksempel: skriv "Hvor gammel er kong Harald, Norges konge?", ikke "KONG HARALD NORGES KONGE ALDER".
- Svar KUN med det omskrevne søket, uten forklaring, anførselstegn eller annen tekst rundt.`

type RewriteRagQueryParams = {
	chatRequest: ChatRequest
	queryText: string
	ragStoreIds: string[]
	user: AuthenticatedPrincipal
	graphToken: string | null
}

// Rewrites the user's latest message into a standalone RAG query - resolving pronouns/references
// against recent conversation history, and nudging the query toward the language the target
// store's documents are actually written in. Runs on a dedicated small utility model, decoupled
// from the chat's own vendor/model entirely (see $lib/server/utility-llm). Falls back to the raw
// query text on any failure, or when there's no history to disambiguate against (e.g. the first
// message in a conversation) - never blocks the main chat flow.
export async function rewriteRagQuery({ chatRequest, queryText, ragStoreIds, user, graphToken }: RewriteRagQueryParams): Promise<string> {
	try {
		const userInputMessage = [...chatRequest.inputs].reverse().find((i): i is ChatInputMessage => i.type === "message.input" && i.role === "user")
		const history = formatHistoryForRewrite(chatRequest.inputs, userInputMessage)
		const languageHint = formatLanguageHint(await getRagStoreLanguages(ragStoreIds, user, graphToken))

		if (!history && !languageHint) {
			// Nothing to disambiguate and no language steering to apply - the raw query is fine as-is.
			return queryText
		}

		const rewriteRequest: ChatRequest = {
			config: buildUtilityConfig(REWRITE_SYSTEM_PROMPT),
			inputs: [
				{
					type: "message.input",
					role: "user",
					content: [{ type: "input_text", text: buildRewritePrompt(history, queryText, languageHint) }]
				}
			],
			stream: false,
			store: false
		}

		const response = await createUtilityChatResponse(rewriteRequest)

		const rewritten = response.outputs
			.flatMap((output) => output.content)
			.filter((c): c is OutputText => c.type === "output_text")
			.map((c) => c.text)
			.join(" ")
			.trim()

		return rewritten || queryText
	} catch (error) {
		logger.errorException(error, "Failed to rewrite RAG query, falling back to raw query text")
		return queryText
	}
}

function formatHistoryForRewrite(inputs: ChatInputItem[], excludeLast: ChatInputMessage | undefined): string {
	const withoutCurrent = excludeLast ? inputs.filter((i) => i !== excludeLast) : inputs

	return withoutCurrent
		.slice(-MAX_HISTORY_ITEMS)
		.map((item) => {
			if (item.type === "message.input") {
				if (item.role !== "user") return null
				const text = item.content
					.filter((c): c is InputText => c.type === "input_text")
					.map((c) => c.text)
					.join(" ")
					.trim()
				return text ? `Bruker: ${text}` : null
			}
			const text = item.content
				.filter((c): c is OutputText => c.type === "output_text")
				.map((c) => c.text)
				.join(" ")
				.trim()
			return text ? `Assistent: ${text}` : null
		})
		.filter((line): line is string => Boolean(line))
		.join("\n")
}

// Collapses the language mix across all involved stores into one hint line, keeping the highest
// percentage seen for each language (rough signal only - good enough to nudge the rewrite model).
function formatLanguageHint(languagesByStore: RagStoreLanguages[]): string {
	const byLanguage = new Map<string, number>()
	for (const { languages } of languagesByStore) {
		for (const { language, percentage } of languages) {
			byLanguage.set(language, Math.max(byLanguage.get(language) ?? 0, percentage))
		}
	}
	if (byLanguage.size === 0) return ""

	return [...byLanguage.entries()]
		.sort(([, a], [, b]) => b - a)
		.map(([language, percentage]) => `${language} (~${Math.round(percentage)}%)`)
		.join(", ")
}

function buildRewritePrompt(history: string, queryText: string, languageHint: string): string {
	const parts: string[] = []
	if (history) parts.push(`Samtalehistorikk:\n${history}`)
	if (languageHint) parts.push(`Språk funnet i kunnskapsbasen: ${languageHint}`)
	parts.push(`Siste spørsmål fra bruker: ${queryText}`)
	parts.push(`Omskrevet søk:`)
	return parts.join("\n\n")
}
