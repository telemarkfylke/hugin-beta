import { logger } from "@vestfoldfylke/loglady"
import { buildUtilityConfig, createUtilityChatResponse } from "$lib/server/utility-llm"
import { FALLBACK_CATEGORY } from "$lib/statsstore/types"
import type { ChatRequest, ChatResponseObject } from "$lib/types/chat"
import type { OutputText } from "$lib/types/chat-item-content"

// The small utility model this runs on (see utility-llm.ts) needs an explicit worked example to
// reliably categorize by what the user is actually asking about rather than by surface keywords -
// same lesson learned for rag-query-rewrite.ts's pronoun resolution. The example below is
// deliberately a case where two plausible categories compete (food vs. transport) so the model
// sees *how* to break the tie, not just what a correct answer looks like.
const buildSystemPrompt = (categories: string[]): string => `Du skal kategorisere brukerens spørsmål inn i NØYAKTIG ÉN av disse kategoriene:
${categories.map((category) => `- ${category}`).join("\n")}
- ${FALLBACK_CATEGORY} (bruk denne hvis spørsmålet ikke tydelig passer noen av kategoriene over)

Tenk gjennom hva spørsmålet egentlig handler om - ikke bare hvilke enkeltord som brukes - og velg kategorien som passer best.

Eksempel: Kategoriene er "Ruter og avganger", "Priser og billetter", "Mat og drikke". Spørsmålet er "Kan jeg ta med meg en kebab på nattbussen?". Spørsmålet nevner bussen, men handler egentlig om hvorvidt man får ha med mat om bord - riktig kategori er "Mat og drikke", ikke "Ruter og avganger".

Svar KUN med navnet på kategorien, skrevet helt likt som i listen over - ingen forklaring, ingen anførselstegn, ingen punktum etter, ingen annen tekst.`

// Deliberately instructed to generalize AWAY from the specifics - this is the mechanism that keeps
// an "Ukategorisert" sample privacy-safe (see UncategorizedSample): it's never allowed to become a
// paraphrase of the actual question, only a topic heading.
const TOPIC_GUESS_SYSTEM_PROMPT = `Du skal beskrive KORT (maks 5-6 ord) og GENERELT hva et spørsmål handler om - som en overskrift, ikke et svar.

Ikke gjenta navn, stedsnavn, datoer, klokkeslett eller andre spesifikke eller identifiserende detaljer fra spørsmålet - beskriv kun det generelle temaet.

Eksempel: Spørsmålet er "Kan jeg ta med kebaben min på nattbussen fra Skien til Porsgrunn i kveld?". Riktig svar: Mat og drikke om bord på buss

Svar KUN med den korte beskrivelsen - ingen anførselstegn, ingen annen tekst.`

// Strips wrapping quotes/punctuation and lowercases, so a near-miss in the model's formatting
// (trailing period, curly quotes, a stray "Kategori: " prefix) doesn't fail to match a category
// that's otherwise clearly the right one.
const normalize = (s: string): string =>
	s
		.trim()
		.toLowerCase()
		.replace(/^["'«]+|["'».,!?:]+$/g, "")
		.trim()

// A weak model occasionally answers on its own first line and then rambles - only the first line of
// its response is ever a candidate answer, for either utility call below.
const firstLine = (response: ChatResponseObject): string => {
	const text = response.outputs
		.flatMap((output) => output.content)
		.filter((c): c is OutputText => c.type === "output_text")
		.map((c) => c.text)
		.join(" ")
		.trim()
	return (text.split("\n")[0] ?? text).trim()
}

const buildUtilityRequest = (systemPrompt: string, questionText: string): ChatRequest => ({
	config: buildUtilityConfig(systemPrompt),
	inputs: [
		{
			type: "message.input",
			role: "user",
			content: [{ type: "input_text", text: questionText }]
		}
	],
	stream: false,
	store: false
})

// Classifies a single user question into one of a chatbot's author-defined categories (see
// ChatConfig.categories), via the shared utility model ($lib/server/utility-llm) - decoupled from
// the chat's own vendor/model entirely, same pattern as rag-query-rewrite.ts. Purely for write-time,
// anonymous usage statistics ($lib/statsstore/types) - the result is never shown to the end user and
// never affects the actual chat response. Falls back to "Ukategorisert" on any failure (unreachable
// utility model, timeout, empty/garbage response) or when the model's answer doesn't match one of
// the configured categories - never throws, so a flaky utility model can't block/skew the caller.
export async function categorizeQuestion(questionText: string, categories: string[]): Promise<string> {
	if (categories.length === 0 || !questionText.trim()) {
		return FALLBACK_CATEGORY
	}

	try {
		const response = await createUtilityChatResponse(buildUtilityRequest(buildSystemPrompt(categories), questionText))
		const answer = normalize(firstLine(response))

		const exactMatch = categories.find((category) => normalize(category) === answer)
		if (exactMatch) {
			return exactMatch
		}

		// Fall back to substring containment (e.g. the model wrapped the category in extra words
		// despite instructions, like "Kategori: Mat og drikke") - longest category name first, so a
		// more specific category ("Mat og drikke") wins over a shorter one that happens to be a
		// substring of it ("Mat").
		const containmentMatch = [...categories].sort((a, b) => b.length - a.length).find((category) => answer.includes(normalize(category)))
		return containmentMatch ?? FALLBACK_CATEGORY
	} catch (error) {
		logger.errorException(error, "Failed to categorize question, falling back to Ukategorisert")
		return FALLBACK_CATEGORY
	}
}

// For a question that didn't match any configured category - generates a short, deliberately
// generalized topic guess (see TOPIC_GUESS_SYSTEM_PROMPT and UncategorizedSample) so a bot author
// can spot unanticipated question types without any real question content ending up in storage.
// Purely a display aid - never grouped/counted like a category, since a weak model won't phrase the
// same underlying topic identically question to question (see the "sample list, not a stat" design
// decision in $lib/statsstore/types). Returns undefined on any failure or empty answer - skipping a
// sample is fine, storing a bad/leaky one isn't.
export async function guessUncategorizedTopic(questionText: string): Promise<string | undefined> {
	if (!questionText.trim()) {
		return undefined
	}

	try {
		const response = await createUtilityChatResponse(buildUtilityRequest(TOPIC_GUESS_SYSTEM_PROMPT, questionText))
		const answer = firstLine(response)
		return answer || undefined
	} catch (error) {
		logger.errorException(error, "Failed to guess uncategorized topic")
		return undefined
	}
}
