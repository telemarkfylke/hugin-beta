import type { searchRagStores } from "$lib/server/ragservice/rag-search"

// Prefix each chunk with the file it came from, so the model can attribute answers back to a
// specific source (e.g. "hva sier Clara.pdf om xxx") instead of treating the whole context blob
// as one undifferentiated source. fileName is optional on a match, so chunks without one are left
// unprefixed rather than rendering an empty "### Fil: " heading.
export const formatRagContextText = (matches: Awaited<ReturnType<typeof searchRagStores>>): string =>
	matches.map((m) => (m.fileName ? `### Fil: ${m.fileName}\n\n${m.text}` : m.text)).join("\n\n---\n\n")
