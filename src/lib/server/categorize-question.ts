import { logger } from "@vestfoldfylke/loglady"
import { buildUtilityConfig, createUtilityChatResponse } from "$lib/server/utility-llm"
import { FALLBACK_CATEGORY } from "$lib/statsstore/types"
import type { ChatRequest, ChatResponseObject } from "$lib/types/chat"
import type { OutputText } from "$lib/types/chat-item-content"

export type CategorizationResult = {
	category: string
	// Only ever set when category === FALLBACK_CATEGORY (see UncategorizedSample) - a topic guess is
	// pointless once a real category was found, so it's dropped rather than carried along unused.
	suggestedTopic?: string
}

// The model is only ever asked to judge match/no-match + supply the matching detail - it never sees
// or produces our own FALLBACK_CATEGORY label. Mapping "no match" to that constant happens entirely
// in categorizeQuestion below, in plain code, not baked into the prompt/model output - keeps the
// model's job minimal and this constant free to change without touching the prompt.
//
// The small utility model this runs on (see utility-llm.ts) needs an explicit worked example to
// reliably categorize by what the user is actually asking about rather than by surface keywords -
// same lesson learned for rag-query-rewrite.ts's pronoun resolution. The topic-guess line is only
// asked for in the no-match case (not on every call) - ties the extra output directly to the
// decision the model is already making, rather than a blanket "always write 2 lines" rule, and
// avoids wasting tokens on a line that's discarded whenever a real category matched anyway. Still
// gets both in ONE call rather than a separate follow-up once a question turns out not to match -
// given how often real-world questions won't fit an author's predefined list, a second utility-model
// round trip would hit a large share of all questions.
const buildSystemPrompt = (categories: string[]): string => `Du skal vurdere om brukerens spørsmål passer inn i EN av disse kategoriene:
${categories.map((category) => `- ${category}`).join("\n")}

Tenk gjennom hva spørsmålet egentlig handler om - ikke bare hvilke enkeltord som brukes.

Svar slik:
- Hvis spørsmålet passer en av kategoriene: svar med "JA" på første linje, og kategorinavnet - skrevet helt likt som i listen over - på andre linje. Ingen forklaring, ingen anførselstegn, ingen punktum etter, ingen annen tekst.
- Hvis spørsmålet IKKE passer noen av kategoriene: svar med "NEI" på første linje, og en kort (maks 5-6 ord) og GENERELL beskrivelse av hva spørsmålet handler om på andre linje - som en overskrift, ikke et svar. Ikke gjenta navn, stedsnavn, datoer, klokkeslett eller andre spesifikke eller identifiserende detaljer fra spørsmålet - beskriv kun det generelle temaet.

Eksempel 1: Kategoriene er "Ruter og avganger", "Priser og billetter", "Mat og drikke". Spørsmålet er "Kan jeg ta med meg en kebab på nattbussen?". Spørsmålet nevner bussen, men handler egentlig om hvorvidt man får ha med mat om bord - riktig kategori er "Mat og drikke", ikke "Ruter og avganger". Riktig svar:
JA
Mat og drikke

Eksempel 2 (spørsmål som ikke passer noen kategori): Kategoriene er "Ruter og avganger", "Priser og billetter". Spørsmålet er "Kan jeg ta med kebaben min på nattbussen fra Skien til Porsgrunn i kveld?" - ingen av kategoriene passer. Riktig svar:
NEI
Mat og drikke om bord på buss`

// Strips wrapping quotes/punctuation and lowercases, so a near-miss in the model's formatting
// (trailing period, curly quotes, a stray "Kategori: " prefix) doesn't fail to match something
// that's otherwise clearly right.
const normalize = (s: string): string =>
	s
		.trim()
		.toLowerCase()
		.replace(/^["'«]+|["'».,!?:]+$/g, "")
		.trim()

// A weak model occasionally rambles beyond the two lines it was asked for - only the first two
// non-empty lines of its response are ever candidate answers.
const responseLines = (response: ChatResponseObject): string[] => {
	const text = response.outputs
		.flatMap((output) => output.content)
		.filter((c): c is OutputText => c.type === "output_text")
		.map((c) => c.text)
		.join(" ")
		.trim()
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
}

// Classifies a single user question into one of a chatbot's author-defined categories (see
// ChatConfig.categories), via the shared utility model ($lib/server/utility-llm) - decoupled from
// the chat's own vendor/model entirely, same pattern as rag-query-rewrite.ts. Purely for write-time,
// anonymous usage statistics ($lib/statsstore/types) - the result is never shown to the end user and
// never affects the actual chat response. Falls back to "Ukategorisert" on any failure (unreachable
// utility model, timeout, empty/garbage response) or when the model's answer doesn't match one of
// the configured categories - never throws, so a flaky utility model can't block/skew the caller.
export async function categorizeQuestion(questionText: string, categories: string[]): Promise<CategorizationResult> {
	if (categories.length === 0 || !questionText.trim()) {
		return { category: FALLBACK_CATEGORY }
	}

	try {
		const request: ChatRequest = {
			config: buildUtilityConfig(buildSystemPrompt(categories)),
			inputs: [
				{
					type: "message.input",
					role: "user",
					content: [{ type: "input_text", text: questionText }]
				}
			],
			stream: false,
			store: false
		}

		const response = await createUtilityChatResponse(request)
		const [matchLine, detailLine] = responseLines(response)
		const claimsMatch = normalize(matchLine ?? "").startsWith("ja")

		if (claimsMatch) {
			const detail = normalize(detailLine ?? "")
			const exactMatch = categories.find((category) => normalize(category) === detail)
			if (exactMatch) {
				return { category: exactMatch }
			}
			// Fall back to substring containment (e.g. the model wrapped the category in extra words
			// despite instructions, like "Kategori: Mat og drikke") - longest category name first, so a
			// more specific category ("Mat og drikke") wins over a shorter one that happens to be a
			// substring of it ("Mat").
			const containmentMatch = [...categories].sort((a, b) => b.length - a.length).find((category) => detail.includes(normalize(category)))
			if (containmentMatch) {
				return { category: containmentMatch }
			}
			// Claimed a match but named something not actually in the list - never trust an invented
			// category name into the stats (that's exactly the "let the model make up categories"
			// cardinality problem we deliberately avoided). Safe default: treat as no match.
		}

		// No match (or an unusable "JA" answer above) - the detail line becomes the topic guess (see
		// UncategorizedSample). Missing/empty is fine - the caller just won't get a sample for it.
		// (Spread conditionally, not `suggestedTopic: detailLine || undefined` - under
		// exactOptionalPropertyTypes an optional field must be omitted, not set to `undefined`.)
		return { category: FALLBACK_CATEGORY, ...(detailLine && { suggestedTopic: detailLine }) }
	} catch (error) {
		logger.errorException(error, "Failed to categorize question, falling back to Ukategorisert")
		return { category: FALLBACK_CATEGORY }
	}
}
