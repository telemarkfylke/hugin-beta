# ADR-0002: Shared Config Access Policy

## Status
Accepted — behavior documented May 2026. Security fix applied 2026-05-28: `/api/chat` now fetches the config from DB before calling `canPromptConfig`, so `shared` is read from the database and cannot be spoofed by the client.

## Context
`ChatConfig` has an optional `shared: boolean` field. In `src/lib/authorization.ts`, `canPromptConfig` returns `true` for any authenticated user if `chatConfig.shared === true`, regardless of config type (`private` or `published`) or ownership.

This means: a user who creates a private config and sets `shared: true` effectively makes it available to any logged-in user who has the config's ID.

## Decision
This behavior is **intentional** and retained as-is. It enables a "share by link" use case: an owner can share a private config with colleagues without publishing it to everyone.

## Implications
- Any authenticated user with a config's `_id` can prompt it if `shared: true`
- There is no audit log for shared access
- There is no expiry for shared links
- The UI does not currently warn users that enabling `shared` makes the config accessible to all authenticated users

## Risks and mitigations
- **Risk:** Users may not understand the access implications of `shared: true`
- **Mitigation (recommended):** Add a clear warning in the UI when a user enables `shared` on a private config
- **Risk:** No audit trail for shared access
- **Mitigation (future):** Add access logging to `canPromptConfig` if audit requirements arise

## Alternatives considered
- **Replace boolean with `visibility: private | shared_link | published`:** Better semantics, but a breaking schema change. Deferred.
- **Add link expiry:** Useful for security-sensitive deployments. Not implemented.
- **Remove shared entirely:** Would break existing behavior for users relying on this feature.

## Where this is implemented
`src/lib/authorization.ts` — `canPromptConfig`, lines 49–80.
Tested in `tests/server/authorization.test.ts` — "currently allows any authenticated user to prompt shared configs".
