# Hugin Beta Refactor, Quality and Security Plan

Branch: `byob-agentrefaktorert-fuzzbin`  
Created after analysis. Implementation progress is tracked at the end of this document.

## How this refactor was done

This refactor was carried out entirely by Claude Code using a multi-agent workflow powered by the [Superpowers plugin](https://claude.com/plugins/superpowers).

Rather than having a single AI session make all changes, the work was broken into focused implementation plans and executed using **subagent-driven development**: each task was dispatched to a fresh subagent with isolated context, followed by two independent review stages — first a spec compliance reviewer (did the implementation match the plan?), then a code quality reviewer (is the code well-written?). Issues found in review were fixed and re-reviewed before the task was marked complete.

This approach produces higher quality than a single-session refactor because:

- **Fresh context per task** — each implementer subagent has no accumulated assumptions or drift from earlier work
- **Independent review** — reviewers are separate agents that did not write the code, making them more likely to catch gaps
- **Two-stage gates** — spec compliance is verified before quality, preventing over-engineering or scope creep from masking missing requirements
- **Incremental verification** — `npm run check`, `npm run lint`, and `npm run test` are run after every task, so regressions are caught immediately

The orchestrating agent (Claude Code in the main session) wrote the implementation plans, dispatched subagents with precise prompts, read their results, and made judgment calls — but never directly edited code. All code changes were made by subagents and reviewed before acceptance.

The result: 113 passing tests, zero type errors, zero lint issues, and a codebase that can be safely extended by the next developer.

## Executive summary

Hugin is a production SvelteKit/Svelte 5 AI chat application with a useful vendor abstraction, strict TypeScript settings, server-side authentication middleware, and working CI/build checks. The project is viable, but it carries production risk from weak runtime boundary validation, mixed domain/API/provider responsibilities, small and mostly placeholder test coverage, in-memory transcription state, inconsistent error handling, and UI state logic that has grown too complex.

Recommended direction:

1. **Do not remove runtime validation completely.** TypeScript is not enough for JSON bodies, EasyAuth headers, DB documents, third-party AI streams, localStorage, or transcription callbacks.
2. **Stop using Zod as the source of all domain types.** Use plain TypeScript domain types as the primary model, and put runtime validators at external boundaries only.
3. **Phase out Zod where validation is simple and stable.** Replace simple request validators with small type guards/assertion functions once tests exist.
4. **Keep or temporarily isolate Zod for high-risk/complex boundaries** such as transcription callbacks and SSE events until equivalent tested validators are in place.
5. **Refactor incrementally behind tests.** First add regression tests around auth, authorization, validation, SSE parsing, file handling, DB store behavior, and API routes. Then simplify.

## Current baseline

Commands run during analysis:

- `npm run test` ✅ passes
- `npm audit --omit=dev --json` ⚠️ reports 1 moderate production vulnerability in transitive `ws` (`GHSA-58qx-3vcg-4xpx`), fix available

Current test coverage is very thin:

- `tests/server/api/http-request-middleware.test.ts` has useful middleware tests.
- `src/demo.spec.ts` and `src/routes/page.svelte.spec.ts` are placeholder tests.
- No meaningful tests currently cover authorization rules, chat request parsing, vendor mapping, SSE chunk parsing, file validation, transcription routes, Mongo access queries, or Svelte state behavior.

Build warnings that should become cleanup items:

- Svelte state warnings in `src/routes/+page.svelte` and `src/routes/agents/[agentId]/+page.svelte`.
- Accessibility warnings in dialogs, overlays, `WelcomeSplash.svelte`, and `Menu.svelte`.
- Non-reactive update warning in `src/lib/components/Chat/ChatInput.svelte`.
- Large client chunk warning, likely from markdown/KaTeX/highlight/provider-related imports.

---

## Code review report

### Project overview

Hugin Beta is a SvelteKit 2 / Svelte 5 / TypeScript 5 application for authenticated multi-provider AI chat. It integrates Microsoft Entra/EasyAuth authentication, OpenAI/Mistral/Ollama/LiteLLM vendor adapters, MongoDB-backed chat configs, SSE streaming, markdown rendering, file upload, and a transcription workflow using Copyparty and a `tale-til-notat` backend.

### Quality summary

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Readability | ⚠️ Needs improvement | Many good type names, but several files have informal comments, placeholder tests, debug logs, long state classes, and duplicated manual object reconstruction. |
| Architecture | ⚠️ Needs improvement | Vendor abstraction is a strength, but route parsing, authorization, validation, persistence, and provider normalization are mixed in several places. |
| Error handling | ⚠️ Needs improvement | Middleware is good, but some validators throw plain `Error`, JSON parsing is inconsistent, and external-service failures are not consistently typed. |
| Type safety | ⚠️ Needs improvement | Strict TS is enabled, but unsafe casts from `unknown`/JSON remain, and Zod schemas only cover selected types. |
| Testing | 🔴 Problem | Current passing suite gives low confidence; two tests are placeholders and core security/data paths are untested. |
| Security | ⚠️ Needs improvement | Auth middleware exists, but boundary validation, shared-agent policy, callback secret handling, markdown HTML rendering, SSRF URL checks, and dependency audit need hardening. |
| Performance | ⚠️ Needs improvement | Base64 file upload inflates payloads, SSE parser assumes full chunks, large bundles are reported, and AI clients are recreated per request. |
| Dependencies | ⚠️ Needs improvement | Dependencies are reasonable, but `ws` audit issue exists; Zod usage should be rationalized; markdown/KaTeX/highlight bundle impact should be reviewed. |
| Configuration | ⚠️ Needs improvement | App config is centralized, but env parsing is loose and required variables are sometimes cast instead of validated. |
| Documentation | ⚠️ Needs improvement | README is broad and useful, but some content is stale/informal; missing ADRs for validation, auth, vendor abstraction, transcription and data retention. |

### Quality summary — after refactor (2026-05-21)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Readability | ✅ Good | Debug logs removed from vendor code, dead mock code deleted, copy-paste comments fixed, ChatState reduced from 370 to 201 lines. Remaining complexity: `PostChatMessage.svelte.ts` SSE switch (142 lines). |
| Architecture | ✅ Good | Routes are thin. `chat-config-service.ts` owns orchestration. `src/lib/validation/` owns all boundary parsing. `src/lib/client/chat/` owns client API calls and request building. Vendor abstraction unchanged and still a strength. |
| Error handling | ✅ Good | All external boundary parsers throw `HTTPError` with correct status codes. `canUpdateChatConfig` still throws plain `Error` due to client-side import constraint (documented). External provider errors mapped via `externalErrorToHTTPError`. |
| Type safety | ✅ Good | Domain types are plain TypeScript. Zod limited to three justified boundaries. `AuthenticatedPrincipalSchema` (dead code) removed. `schemaForType` workaround removed. Strict mode with `noUncheckedIndexedAccess` passes cleanly. |
| Testing | ✅ Good | 113 tests across 19 files covering auth, authorization, validation, SSE streaming, vendor file upload, service layer, client API, SSRF guards, and schema validation. No placeholder tests remain. Gaps: vendor mapping logic and Mongo access-query logic untested. |
| Security | ✅ Good | `MOCK_AUTH=true` rejected in production. EasyAuth claims validated strictly. HTML disabled in markdown. `startsWith` SSRF guards replaced with URL origin comparison. `npm audit --omit=dev` reports zero vulnerabilities. Remaining: callback secret in query string (service dependency). |
| Performance | ⚠️ Unchanged | Base64 file upload, per-request AI client instantiation, and large client bundle are unchanged. These were out of scope for this refactor. |
| Dependencies | ✅ Good | `ws` audit issue resolved. Zod rationalised — schemas in validation layer only, no longer coupled to domain types. `ollama-supported-filetypes.ts` (unused) deleted. |
| Configuration | ✅ Good | App roles validated at startup with explicit errors. `MOCK_AUTH` production guard in place. `BODY_SIZE_LIMIT` parsed safely. All required env vars documented in `.env.example` and README. |
| Documentation | ✅ Good | README updated to reflect current architecture. Two ADRs written: validation strategy and shared-link policy. `REFACTOR_PLAN.md` has full progress log and remaining-work list. `CLAUDE.md` updated. |

---

## Key findings and risks

### 1. Runtime validation is inconsistent and sometimes unsafe

- **Where:** `src/routes/api/chat/+server.ts:13-40`, `src/lib/validation/parse-chat-config.ts:5-64`
- **What:** `parseChatRequest` casts raw JSON to `ChatRequest` after only checking that the body is an object. It validates `config`, but does not validate the shape of `inputs`. `parseChatConfig` uses `ChatConfigSchema.parse`, which throws `ZodError`, not `HTTPError`, so invalid config bodies can become 500 instead of 400.
- **Impact:** Invalid or malicious request bodies can travel deeper into vendor mappings, causing provider errors, 500s, confusing logs, or unexpected behavior.
- **Fix:** Add a dedicated `parseChatRequest` boundary validator that returns typed `ChatRequest` or throws `HTTPError(400)`. Validate all `inputs` content. Add tests before changing behavior.

### 2. Zod is useful, but currently coupled too tightly to domain types

- **Where:** `src/lib/types/chat.ts:1-132`, `src/lib/types/streaming.ts`, `src/lib/server/transcription/types.ts`
- **What:** `ChatConfig` is a TypeScript type, then a Zod schema attempts to mirror it via `schemaForType`. This creates maintenance overhead and manual reconstruction in `parseChatConfig`.
- **Impact:** Type and runtime schema can drift. Optional fields are easy to forget, as noted in the code comment in `parse-chat-config.ts:47`.
- **Fix:** Move runtime validators out of domain type files into `src/lib/validation/**`. Keep domain types plain. Use small tested parsing functions at boundaries.

### 3. Authorization allows shared private agents to be prompted by anyone with link

- **Where:** `src/lib/authorization.ts:49-80`, especially `chatConfig.shared` at lines 53-55
- **What:** If `shared` is true, any authenticated user can prompt the config, regardless of owner/group/type.
- **Impact:** This may be intentional, but for production it is a security/product decision that needs explicit documentation, tests, and probably a UI warning/audit trail.
- **Fix:** Add tests locking current behavior, document it as an ADR/product rule, and consider changing `shared` from boolean to explicit sharing policy: `private | link | published`.

### 4. Auth claim parsing is manual and incomplete

- **Where:** `src/lib/server/auth/get-authenticated-user.ts:8-72`
- **What:** Claims JSON is cast after a few object/array checks. Individual claim objects are not validated for string `typ`/`val`; required auth metadata is checked only for truthiness.
- **Impact:** Bad headers may produce unclear auth failures. Since this is security-sensitive, validation should be exact and tested.
- **Fix:** Use a boundary parser for EasyAuth principal claims. This is one of the strongest places to keep a runtime validator, whether Zod or plain tested guards.

### 5. SSE parsing assumes network chunks align with event boundaries

- **Where:** `src/lib/streaming.ts:36-62`, `src/lib/components/Chat/PostChatMessage.svelte.ts:73-77`
- **What:** `parseSse` requires every chunk to end with `\n\n`. HTTP streams do not guarantee that a read chunk contains complete SSE events.
- **Impact:** Streaming can fail randomly under real network/proxy conditions.
- **Fix:** Replace `parseSse(chunk)` with a stateful SSE parser/buffer that accepts partial chunks and emits complete events. Add tests for split events, multiple events in one chunk, invalid JSON, and comments/empty lines.

### 6. Markdown rendering uses `{@html}` and needs explicit sanitization policy

- **Where:** `src/lib/formatting/markdown-formatter.ts:13-53`, rendered in `src/lib/components/Chat/ChatItems/MessageItem.svelte`
- **What:** Assistant output is converted to HTML and rendered with `{@html}`. Markdown-it defaults reduce risk if raw HTML is disabled, but production should not rely on implicit defaults/plugins without tests.
- **Impact:** Potential XSS if markdown configuration changes, a plugin allows HTML, or links/attributes are not constrained.
- **Fix:** Explicitly set `html: false`, validate/sanitize rendered HTML with a chosen sanitizer or strict markdown policy, test malicious payloads, and consider a CSP.

### 7. Transcription job state is in memory

- **Where:** `src/lib/server/transcription/job-store.ts`
- **What:** Jobs are stored in a module-level `Map`.
- **Impact:** Jobs disappear on restart/deploy, multi-instance production will be inconsistent, callback matching may attach to the wrong job after restart, and localStorage fallback adds client-trust complexity.
- **Fix:** Introduce persistent `ITranscriptionJobStore`, initially backed by MongoDB. Keep in-memory only for local tests/dev.

### 8. Callback secret is passed in query string

- **Where:** `src/routes/api/transcription/+server.ts:56-60`, `src/routes/api/transcription/callback/+server.ts`
- **What:** The transcription callback secret is embedded in the URL query.
- **Impact:** Query strings can be logged by proxies, app servers, monitoring, or browser history if exposed.
- **Fix:** Prefer a signed callback body or `Authorization: Bearer`/custom header if the external service supports it. If query string is required, document risk and ensure logs never capture full callback URLs.

### 9. SSRF URL checks use `startsWith` rather than origin/path normalization

- **Where:** `src/routes/api/transcription/+server.ts:91-104`, `src/routes/api/transcription/[id]/download/+server.ts`
- **What:** The code uses `startsWith(copypartyBase)` to decide if a URL is trusted.
- **Impact:** `startsWith` can be bypass-prone depending on base formatting and URL variants.
- **Fix:** Use `new URL()`, compare protocol/host/origin and normalized pathname prefix. Add SSRF tests.

### 10. DB ObjectId parsing can throw unhandled errors

- **Where:** `src/lib/server/db/mongo-db.ts:40-42`, `87-97`
- **What:** `new ObjectId(configId)` throws for invalid IDs.
- **Impact:** Invalid IDs can become 500 instead of 400/404.
- **Fix:** Validate `ObjectId.isValid(configId)` in route or store and return controlled errors. Add route/store tests.

### 11. ChatState is doing too much

- **Where:** `src/lib/components/Chat/ChatState.svelte.ts:73-370`
- **What:** One class owns chat state, file conversion, prompt request construction, mock loading, config save/update/delete, navigation, error handling, and web search tool merging.
- **Impact:** Hard to test, hard to reason about, and likely source of unnecessary complexity.
- **Fix:** Extract pure functions and client services: file conversion, request building, config API client, streaming reducer, and navigation/UI confirmation boundaries.

### 12. Current tests do not protect production behavior

- **Where:** `src/demo.spec.ts`, `src/routes/page.svelte.spec.ts`, `tests/server/api/http-request-middleware.test.ts`
- **What:** Only middleware has real tests. The rest are placeholders.
- **Impact:** Refactor risk is high.
- **Fix:** Add meaningful tests before each refactor phase and remove placeholder tests.

---

## Validation strategy: Zod vs plain TypeScript

### Recommendation

Use **plain TypeScript for internal domain modelling** and **runtime validation only at trust boundaries**.

TypeScript alone is enough for:

- Internal pure functions once inputs are already validated.
- Domain objects created inside trusted code.
- Provider abstraction interfaces and compile-time contracts.
- UI component props derived from server-loaded typed data, as long as server boundaries validate.

Runtime validation is still required for:

- `request.json()` from API routes.
- EasyAuth `X-MS-CLIENT-PRINCIPAL` header.
- MongoDB documents read from production data.
- AI provider streaming events if provider SDK types are not sufficient at runtime.
- SSE JSON parsed in the browser.
- LocalStorage/imported conversation files.
- Transcription callbacks and external-service responses.
- Environment variables at startup.

### How to remove/reduce Zod safely

1. **Phase 1: isolate Zod.** Move schemas out of `src/lib/types/**` into `src/lib/validation/**`. Domain types remain plain TypeScript.
2. **Phase 2: wrap all schemas behind parse functions.** No route or component should call `Schema.parse` directly.
3. **Phase 3: replace simple schemas with plain assertion functions.** For example, `assertString`, `assertEnum`, `parseCreateTranscriptionJobBody`, `parseDeleteTranscriptionJobBody`.
4. **Phase 4: decide whether to keep Zod for complex payloads.** Good candidates to keep temporarily: transcription callback, SSE event union, EasyAuth claims. If removing Zod fully, replace these with exhaustive discriminated-union guards and golden tests.
5. **Phase 5: remove Zod dependency only if all runtime validators are covered by tests.** Do not remove it simply because TypeScript compiles.

Practical conclusion: **I would not remove Zod in the first implementation phase.** I would first isolate it and reduce its scope. Full removal can be a later milestone if the new validators stay readable.

---

## Target architecture

### Proposed module boundaries

```text
src/lib/domain/
  chat.ts                  Plain domain types and constructors
  auth.ts                  Plain auth/user types
  transcription.ts         Plain transcription types

src/lib/validation/
  env.ts                   Startup env parsing
  auth-principal.ts        EasyAuth principal parser
  chat-request.ts          POST /api/chat body parser
  chat-config.ts           ChatConfig create/update parser
  sse.ts                   SSE event parser/guards
  transcription.ts         Transcription route/callback parsers
  file-input.ts            File MIME/data URL validation

src/lib/server/services/
  chat-config-service.ts   Authorization + persistence orchestration
  chat-service.ts          Chat request orchestration
  transcription-service.ts Transcription workflow orchestration

src/lib/server/vendors/
  openai/
  mistral/
  ollama/
  litellm/

src/lib/client/chat/
  build-chat-request.ts    Pure request builder
  stream-reducer.ts        Pure reducer for SSE events
  chat-api-client.ts       fetch wrappers
  file-content.ts          File to message content conversion
```

### Rules for the refactor

- API routes should be thin: authenticate, parse input, call service, return response.
- Services own authorization and orchestration.
- Stores own persistence only.
- Vendor adapters own provider-specific mapping only.
- Client state classes should delegate to pure functions/services.
- Validation functions should throw typed, intentional errors (`HTTPError` server-side; typed UI errors client-side).
- All external boundaries need tests before behavior changes.

---

## Prioritized implementation roadmap

### Phase 0 — Safety baseline and decision records

**Goal:** Make future refactors safe and explicit.

1. Add this plan to the branch. ✅
2. Create ADRs/docs:
   - `docs/adr/0001-validation-strategy.md`
   - `docs/adr/0002-auth-and-authorization-model.md`
   - `docs/adr/0003-ai-vendor-boundary.md`
   - `docs/adr/0004-transcription-data-retention.md`
3. Turn current build warnings into tracked cleanup tasks.
4. Update README to remove informal/stale comments and document production assumptions.

Acceptance criteria:

- No production code behavior changed.
- Docs describe current behavior and desired target behavior.

### Phase 1 — Test foundation before refactor

**Goal:** Replace placeholder tests with meaningful regression tests.

Add tests for:

1. `authorization.ts`
   - admin access
   - maintainer access
   - private owner access
   - published access groups
   - Entra group access
   - shared-link behavior
2. `get-authenticated-user.ts`
   - valid EasyAuth header
   - malformed base64/JSON
   - missing object id/name/roles
   - unknown claim type handling
3. `parse-chat-config.ts` and future `parse-chat-request.ts`
   - valid manual config
   - valid vendorAgent config
   - unsupported vendor/project/model
   - invalid body maps to 400
   - invalid/missing inputs rejected
4. `file-input.ts`
   - accepted data URLs
   - rejected MIME types
   - previous invalid files filtered as intended
   - malformed data URLs rejected
5. `streaming.ts`
   - create valid SSE
   - parse multiple events
   - parse split event chunks after parser refactor
   - reject invalid event/data JSON
6. Vendor mappings
   - OpenAI input/output mapping
   - Mistral input/output mapping
   - unsupported item behavior
7. Transcription routes/services
   - create/patch/delete validation
   - upload path traversal rejection
   - SSRF URL rejection
   - callback secret/auth behavior
8. DB store
   - invalid ObjectId handling
   - access query behavior for role/group/private/published configs
9. Client state pure functions after extraction
   - chat request building
   - web-search tool toggling
   - stream reducer updates

Acceptance criteria:

- Remove `src/demo.spec.ts` and placeholder `src/routes/page.svelte.spec.ts`, or replace them with real tests.
- `npm run test` remains green.

### Phase 2 — Boundary validation cleanup

**Goal:** Make all external inputs validated and all validation failures intentional 400/401/403 responses.

Tasks:

1. Implement `src/lib/validation/chat-request.ts`.
2. Replace direct `ChatConfigSchema.parse` usage with `parseChatConfig` that catches validation errors and throws `HTTPError(400)`.
3. Validate `ChatInputItem[]` fully.
4. Move Zod schemas out of `src/lib/types` or wrap them so domain files are plain types.
5. Validate app env at startup with a clear `parseAppConfig(env)`.
6. Validate MongoDB documents on read or introduce migration/normalization functions.

Acceptance criteria:

- Invalid JSON/body shapes never cause accidental 500s.
- Domain type files no longer import Zod unless explicitly decided.
- Tests prove accepted/rejected request behavior.

### Phase 3 — Authentication and authorization hardening

**Goal:** Make auth behavior auditable and tested.

Tasks:

1. Replace manual EasyAuth casting with a tested parser.
2. Document and test the exact meaning of roles and groups.
3. Reassess `shared` access policy. Options:
   - Keep as “any authenticated user with link” and document clearly.
   - Replace with `visibility: private | shared_link | published`.
   - Add expiration/audit log for shared links.
4. Make admin route use common middleware if possible.
5. Ensure production rejects `MOCK_AUTH=true` unless explicitly in local/test mode.

Acceptance criteria:

- Authorization matrix is documented and tested.
- Shared-link behavior is a deliberate product decision, not an accident.

### Phase 4 — SSE and streaming reliability

**Goal:** Make streaming robust under real network conditions.

Tasks:

1. Replace chunk-based `parseSse` with stateful parser/buffer.
2. Add stream reducer that maps `MuginSse` events to immutable/predictable state updates.
3. Standardize vendor stream events and remove duplicate/unneeded events.
4. Ensure errors from provider streams result in valid SSE `response.error` events.
5. Remove noisy `console.log`/`console.warn` from streaming paths or replace with structured logger server-side.

Acceptance criteria:

- Split/multi-event chunks are tested.
- Streaming does not fail because of chunk boundaries.
- UI receives a typed sequence of events and updates predictably.

### Phase 5 — ChatState and UI state simplification

**Goal:** Make client code readable and testable.

Tasks:

1. Extract file conversion into `src/lib/client/chat/file-content.ts`.
2. Extract request construction into `build-chat-request.ts`.
3. Extract chat config API calls into `chat-config-client.ts`.
4. Extract SSE application into `stream-reducer.ts`.
5. Remove mocked `loadChat` from production `ChatState` or move to tests/fixtures.
6. Replace `JSON.parse(JSON.stringify(...))` clones with `structuredClone` or a typed helper.
7. Fix Svelte warnings in page components and non-reactive state warnings.
8. Address accessibility warnings for dialogs/overlays.

Acceptance criteria:

- `ChatState.svelte.ts` becomes a small orchestration/state class.
- Core behavior is testable without Svelte component rendering.
- Build warnings are reduced or documented.

### Phase 6 — Server service refactor

**Goal:** Reduce complexity in routes and centralize business logic.

Tasks:

1. Introduce `chat-service` for parsing/authorization/vendor dispatch.
2. Introduce `chat-config-service` for create/update/delete rules.
3. Keep routes thin.
4. Remove `@ts-expect-error` delete patterns by using typed object destructuring.
5. Validate route params before store calls.

Acceptance criteria:

- API routes are easy to read.
- No intentional type suppressions remain for core CRUD.
- Tests cover service behavior directly.

### Phase 7 — Transcription production hardening

**Goal:** Make transcription reliable in production.

Tasks:

1. Create `ITranscriptionJobStore`.
2. Add Mongo-backed job persistence.
3. Keep in-memory store only for tests/local dev.
4. Replace query-string callback secret with header/signed callback if possible.
5. Normalize Copyparty URL checks using `URL` parsing.
6. Add retention policy and cleanup job for uploaded audio/docx.
7. Add structured logs for job lifecycle without leaking secrets/URLs.

Acceptance criteria:

- Jobs survive app restart.
- Multi-instance deployment is safe.
- SSRF/path traversal tests exist.

### Phase 8 — Dependency, bundle and security cleanup

**Goal:** Reduce operational and security risk.

Tasks:

1. Fix `npm audit --omit=dev` moderate `ws` advisory.
2. Review direct dependencies and remove unused packages.
3. Consider dynamic imports for heavy markdown/KaTeX/highlight functionality.
4. Explicitly configure markdown-it with safe options and add sanitizer/CSP as needed.
5. Review GitHub Actions deployment action: this is a SvelteKit Node app, but workflows use `Azure/functions-action@v1`; confirm this is intentional or replace with Web Apps deployment.
6. Add CI gates for `npm audit --omit=dev` if feasible.

Acceptance criteria:

- Production audit is clean or documented with accepted risk.
- Bundle warning is addressed or justified.
- Security-sensitive rendering is tested.

### Phase 9 — Documentation and operational readiness

**Goal:** Make the project maintainable by other developers/operators.

Tasks:

1. Update README with accurate architecture and environment variables.
2. Add `docs/testing.md` with how to run unit/integration tests.
3. Add `docs/security.md` covering auth, sharing, file uploads, callbacks, and markdown rendering.
4. Add `docs/operations.md` for deployment, env vars, logging, and troubleshooting.
5. Add examples for local `.env` and test env setup.

Acceptance criteria:

- A new developer can run, test, and understand the app without reading source code first.
- Production operators know which env vars are required and what failure modes look like.

---

## Suggested first implementation PR sequence

1. **PR 1: Tests only**
   - Authorization tests
   - Auth claim parser tests
   - Current `parseChatConfig`/file validation tests
   - SSE current behavior tests, including failing/skipped test documenting split chunk issue

2. **PR 2: Validation boundary cleanup**
   - New `parseChatRequest`
   - Convert invalid config errors to 400
   - Move/wrap Zod schemas out of domain types

3. **PR 3: SSE parser fix**
   - Stateful parser
   - Stream reducer tests
   - Update `PostChatMessage.svelte.ts`

4. **PR 4: Auth/authorization hardening**
   - Strong EasyAuth parser
   - Authorization ADR
   - Shared-link decision implemented or documented

5. **PR 5: ChatState extraction**
   - Pure helpers and API clients
   - Remove mock `loadChat`
   - Fix Svelte warnings

6. **PR 6: Transcription hardening**
   - Persistent store abstraction
   - URL normalization
   - Callback auth improvements

7. **PR 7: Security/dependency/docs cleanup**
   - Audit fix
   - Markdown policy/sanitization
   - README/docs refresh

---

## Progress log

### 2026-05-21 — First implementation slice

Completed:

- Added meaningful server-side regression tests for authorization, EasyAuth principal parsing, chat config parsing, chat request parsing, file input validation, SSE parsing, and markdown escaping.
- Removed placeholder tests: `src/demo.spec.ts` and `src/routes/page.svelte.spec.ts`.
- Added `src/lib/validation/parse-chat-request.ts` with explicit runtime validation for `/api/chat` request bodies.
- Changed `parseChatConfig` invalid-shape errors from accidental Zod errors to controlled `HTTPError(400)` responses.
- Replaced fragile chunk-based streaming consumption with a buffered SSE parser via `createSseParser()`.
- Explicitly configured markdown-it with `html: false` and added tests around HTML escaping.
- Updated `package-lock.json` to resolve the production `ws` audit advisory. `npm audit --omit=dev` now reports zero vulnerabilities.

Verified:

- `npm run test` passes.
- `npm audit --omit=dev` reports zero production vulnerabilities.

Known remaining warnings:

- Large client chunk size remains and should be handled in a later bundle-splitting pass.

### 2026-05-21 — Svelte warning cleanup

Completed:

- Removed Svelte state-reference warnings from home and agent pages.
- Replaced clickable non-interactive modal/overlay elements with accessible button backdrops and dialog roles.
- Fixed non-reactive `fileInput` DOM reference in `ChatInput.svelte`.
- Removed unused empty chat CSS selector.

Verified:

- `npm run check` reports 0 errors and 0 warnings.
- `npm run test` passes.

### 2026-05-21 — Auth/env validation hardening

Completed:

- Added a strict EasyAuth principal claim parser that validates top-level metadata and every claim object before casting to application types.
- Kept unknown claim types as warnings while rejecting malformed claims.
- Added app role environment parsing so required role variables fail early with explicit errors.
- Added a production guard against `MOCK_AUTH=true`, with an explicit `BUILD_PLACEHOLDER_CONFIG=true` escape hatch for `.env.build` placeholder builds.
- Added tests for auth principal parsing and env validation.

Verified:

- `npm run check` reports 0 errors and 0 warnings.
- `npm run test` passes.

### 2026-05-21 — Chat config/ObjectId hardening

Completed:

- Added strict ObjectId format validation helper.
- Hardened Mongo chat config store so invalid IDs do not throw from `new ObjectId(...)` in read paths.
- Added defensive invalid-ID checks before Mongo replace/delete operations.
- Removed chatconfig route `@ts-expect-error` delete patterns by adding a typed `omitChatConfigId` helper.
- Removed an obsolete markdown plugin `@ts-expect-error` by using the typed plugin import directly.
- Added tests for ObjectId validation and chat config ID omission.

Verified:

- `npm run check` reports 0 errors and 0 warnings.
- `npm run test` passes.

### 2026-05-21 — Chat config service extraction

Completed:

- Created `src/lib/server/services/chat-config-service.ts` with `listChatConfigs`, `createChatConfig`, `replaceChatConfig`, and `deleteChatConfig`.
- Moved parsing, authorization, ownership stamping, and persistence orchestration out of route handlers into the service.
- Fixed correctness bug: `replaceChatConfig` now preserves `existing.created` from the DB and stamps `updated` server-side; both fields were previously client-controllable.
- Slimmed `src/routes/api/chatconfigs/+server.ts` and `src/routes/api/chatconfigs/[_id]/+server.ts` to thin param-extraction + service-call + json-response handlers.
- Added `tests/server/api/chat-config-service.test.ts` with 19 unit tests covering all four service operations: 400/403/404 error paths, happy paths, ownership stamping, timestamp format, and maintainer-on-published permission edges.
- No behavior changes to existing API contracts.

Verified:

- `npm run check` reports 0 errors and 0 warnings.
- `npm run lint` reports 0 issues.
- `npm run test` passes (79 tests across 15 files).

### 2026-05-21 — ChatState decomposition (Phase 5, partial)

Completed:

- Deleted `loadChat` mock method (103 lines of hardcoded fixture data with `setTimeout`).
- Replaced `JSON.parse(JSON.stringify(...))` clones with `structuredClone` (two occurrences).
- Extracted `buildChatRequest` pure function to `src/lib/client/chat/build-chat-request.ts` with 8 unit tests covering history flattening, web search tool toggling, stream/store flags, and name fallback. `promptChat` reduced from 23-line inline block to a single call.
- Extracted `saveChatConfig`, `updateChatConfig`, `deleteChatConfig` fetch wrappers to `src/lib/client/chat/chat-config-client.ts` with 6 unit tests covering happy paths and error propagation. No `console.error`, no navigation, no UI concerns in the client module.
- `ChatState.svelte.ts` reduced from 370 to 201 lines. Owns only reactive state, UI orchestration (`confirm`, `goto`), and Svelte-specific concerns.

Remaining Phase 5 items:
- File conversion (`fileToBase64Url`, `fileToMessageContent`) could move to `src/lib/client/chat/file-content.ts` if standalone testability is needed.
- `PostChatMessage.svelte.ts` SSE switch statement could be extracted to a stream reducer.

Verified:

- `npm run check` reports 0 errors and 0 warnings.
- `npm run lint` reports 0 issues.
- `npm run test` passes (93 tests across 17 files).

### 2026-05-21 — Phase 7: Transcription hardening (partial)

Completed:

- Extracted `CreateJobSchema`, `UpdateJobSchema`, `DeleteJobSchema` from `src/routes/api/transcription/+server.ts` into `src/lib/validation/transcription.ts`, consistent with the validation layer pattern used elsewhere.
- Added 11 unit tests for the three schemas covering valid inputs, empty strings, invalid URLs, null values, and unknown enum values.
- Added `isTrustedCopypartyUrl(url, base)` helper in `src/lib/server/transcription/copyparty-url.ts` using `URL` origin comparison instead of `startsWith`.
- Replaced all three `startsWith(copypartyBase)` SSRF guards with `isTrustedCopypartyUrl` in both transcription route files.
- Added 9 unit tests covering same-origin acceptance, trailing-slash normalization, subdomain spoofing attack, scheme mismatch, port mismatch, malformed URLs, and empty strings.
- No breaking changes to any external API contracts.

Deferred:
- Callback secret in query string (requires coordinated change with `tale-til-notat` service).
- In-memory job store (requires Mongo-backed `ITranscriptionJobStore` — deferred until persistence is needed in production).

Verified:

- `npm run check` reports 0 errors and 0 warnings.
- `npm run lint` reports 0 issues.
- `npm run test` passes (113 tests across 19 files).

## Remaining work

Items still open as of 2026-05-21. Ordered by impact.

### High priority (production risk)

- **Mongo-backed transcription job store** — current in-memory store loses all jobs on restart/redeploy. Multi-instance deployments will have inconsistent state. Implement `ITranscriptionJobStore` backed by MongoDB (see Phase 7).

### Medium priority (test coverage gaps)

- **Vendor mapping tests** — no tests for OpenAI, Mistral, Ollama, or LiteLLM mapping logic. A vendor SDK update could silently break input/output mapping. Add tests in `tests/server/` for each vendor's mapping functions.
- **DB store access-query tests** — no tests for `MongoChatConfigStore.getChatConfigs` Mongo query logic. The mock and Mongo stores share `getUserRoleAccessGroups` but the Mongo `$or` query itself is untested. Add integration-style tests against an in-memory Mongo or test that the query is constructed correctly.

### Low priority (code quality)

- **`PostChatMessage.svelte.ts` stream reducer** — the SSE switch statement (142 lines) is untestable in isolation. Extract to a pure `applyStreamEvent(state, event)` reducer function with unit tests (see Phase 4 remainder).
- **`fileToBase64Url` / `fileToMessageContent`** — still module-level functions in `ChatState.svelte.ts`. Extract to `src/lib/client/chat/file-content.ts` if standalone testability is needed (see Phase 5 remainder).
- **Transcription callback secret** — currently passed in query string (`?secret=...`). Move to `Authorization: Bearer` header when `tale-til-notat` service supports it (see Phase 7 deferred).

### Documentation

- **ADR-0003: AI vendor boundary** — document why `IAIVendor` exists, how vendors are registered, and how to add a new provider.
- **UI warning for `shared: true`** — per ADR-0002, users should see a warning when enabling sharing on a private config. Currently undocumented in the UI.

---

## Definition of done for the overall refactor

- `npm run test` passes.
- Meaningful tests cover auth, authorization, validation, SSE, vendor mapping, DB store behavior, file validation, and transcription workflows.
- No placeholder tests remain.
- Invalid API inputs return controlled 400/401/403 responses, not accidental 500s.
- Domain types are plain TypeScript; runtime validation is isolated at boundaries.
- Zod is either removed or kept only where explicitly justified by ADR.
- Security-sensitive behavior is documented and tested.
- Svelte build warnings are resolved or explicitly accepted.
- `npm audit --omit=dev` is clean or documented.
- README and docs match current production behavior.

---

## Progress log additions — Phase 9

### 2026-05-21 — Phase 9: Documentation

Completed:

- Updated `README.md`: fixed stale "Zod-first" type system description; corrected auth section (plain type guards, not Zod); replaced informal authorization bullet points with a role/function table; updated project structure to include `validation/`, `services/`, `client/`, `transcription/` directories; fixed API reference (`PUT` not `PATCH` for chat configs, full transcription API table); fixed production env vars (`MONGODB_CONNECTION_STRING`, added `APP_ROLE_EDU_EMPLOYEE`, transcription variables, MOCK_AUTH security note).
- Created `docs/adr/0001-validation-strategy.md`: documents the boundary-only validation decision, maps every boundary to its validator and file, and states the Zod placement rule.
- Created `docs/adr/0002-shared-link-policy.md`: documents the intentional `shared: true` access behavior, its risks, and deferred alternatives.

Verified:

- `npm run check` reports 0 errors and 0 warnings.
- `npm run test` passes (113 tests across 19 files).
