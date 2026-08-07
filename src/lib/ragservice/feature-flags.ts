import { env } from "$env/dynamic/public"

// Temporary switches for ragservice UI fields that exist in the data model but aren't ready to be
// user-facing yet. Read from env (dynamic, not static, so no rebuild is needed to flip them) and
// default to off.

// Reranking doesn't work reliably yet - hidden from Create/Settings/Search UIs until it does.
// The rerank state/logic itself is untouched - set PUBLIC_FEATURE_RERANK="true" to bring it back.
export const RERANK_ENABLED = env.PUBLIC_FEATURE_RERANK === "true"
