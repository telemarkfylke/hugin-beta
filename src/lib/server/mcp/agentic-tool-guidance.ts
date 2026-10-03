// Function-calling tools (SharePoint, browse_website) are treated much more conservatively by
// most models than a native/built-in tool like web_search - left to their own judgment, a model
// tends to only reach for a custom tool when the user explicitly asks it to "check"/"search"/
// "look up", rather than proactively using it whenever it would produce a better-grounded answer.
// RAG datasources don't have this problem at all (the search runs server-side unconditionally,
// see appendRagContextToInstructions/rag-search.ts) - the model never has to decide to use it.
// Agentic tool-calling has no such automatic step, so this appends an explicit nudge instead.
//
// The second sentence (don't guess paths) was added after live testing: a model asked "who is
// Eldrin" guessed `Get_Document_Content({folder_name: "Profiles", file_name: "Eldrin.txt"})` out of
// a generic prior about how files are usually organized, several turns before it ever called
// List_SharePoint_Documents to see what was actually there. The folder-scope rejection message
// (see scoped-sharepoint-client.ts) now also names the real allowed folders as a second line of
// defense, but guiding the model away from guessing in the first place avoids the wasted,
// confusing failed turn entirely.
const AGENTIC_TOOL_GUIDANCE =
	"Du har tilgang til verktøy for å hente informasjon fra koblede datakilder (f.eks. SharePoint-mapper eller nettsider). Bruk disse verktøyene aktivt for å undersøke relevant innhold FØR du svarer, når spørsmålet kan besvares bedre med informasjon derfra - ikke vent til brukeren eksplisitt ber deg om å søke, sjekke eller undersøke kildene. Gjett ALDRI mappe- eller filnavn - list alltid innholdet i en tillatt mappe først (f.eks. med List_SharePoint_Folders/List_SharePoint_Documents) for å se hva som faktisk finnes, og bruk de eksakte navnene derfra i videre kall."

export const appendAgenticToolGuidance = (instructions: string | undefined): string => {
	return instructions ? `${instructions}\n\n${AGENTIC_TOOL_GUIDANCE}` : AGENTIC_TOOL_GUIDANCE
}
