import type { AuthenticatedPrincipal } from "./types/authentication"

// Synthetic principal for the unauthenticated /public/embed/** routes - never a real identity,
// never validated against any auth provider. Used purely so the rest of the chat plumbing
// (ChatState, searchRagStores, etc) that expects an AuthenticatedPrincipal has something to hold.
export const ANONYMOUS_PRINCIPAL: AuthenticatedPrincipal = {
	userId: "anonymous",
	name: "Gjest",
	preferredUserName: "anonymous",
	roles: [],
	groups: []
}
