# Phase 9: Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update README and CLAUDE.md to reflect current architecture, and write two ADRs documenting the two most important undocumented decisions in the codebase.

**Architecture:** Three independent tasks. Task 1 rewrites the stale sections of README.md. Task 2 adds two ADR files under `docs/adr/`. Task 3 updates REFACTOR_PLAN.md. No code changes — documentation only.

**Tech Stack:** Markdown. No tests needed — documentation is verified by reading, not by running.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `README.md` | Fix stale type system section, auth description, project structure, API reference, add transcription section |
| Create | `docs/adr/0001-validation-strategy.md` | Documents why validation is at boundaries only and where Zod is used |
| Create | `docs/adr/0002-shared-link-policy.md` | Documents the intentional `shared: true` access policy |
| Modify | `REFACTOR_PLAN.md` | Progress entry for Phase 9 |

---

### Task 1: Update README.md

**Files:**
- Modify: `README.md`

The README has several stale or incorrect sections that give new developers a wrong mental model:

1. **Authentication section (line 107):** Says "validates claims with Zod" — now uses plain type guards in `auth-principal.ts`
2. **Authorization section (lines 132–135):** Informal, partial description — needs to reflect `authorization.ts` functions and the role model
3. **Type System section (lines 277–294):** Says "Zod-first approach, all types defined as Zod schemas" — this is no longer true
4. **Project structure (lines 204–232):** Says `types/` contains "Zod schemas and TypeScript types" — most types are now plain TypeScript; missing `validation/`, `services/`, `client/` directories
5. **API Reference (lines 269–272):** Says `PATCH /api/chatconfigs/[_id]` — the actual method is `PUT`
6. **Missing:** Transcription system, validation layer, services layer

- [ ] **Step 1.1: Fix the Authentication section**

Find and replace the stale auth description:

```markdown
<!-- Replace this: -->
3. Middleware extracts and validates claims with Zod
4. `AuthenticatedPrincipal` object created with userId, name, roles, and groups

<!-- With this: -->
3. Middleware extracts and validates claims using plain type guards in `src/lib/validation/auth-principal.ts`
4. `AuthenticatedPrincipal` object created with userId, name, roles, and groups
```

- [ ] **Step 1.2: Fix the Authorization section**

Replace the informal authorization section (starting at "### Authorization") with:

```markdown
### Authorization

Authorization uses role-based and group-based access control via functions in `src/lib/authorization.ts`:

| Function | Who can call it |
|----------|----------------|
| `canViewAllChatConfigs` | Admin |
| `canPublishChatConfig` | Admin, AgentMaintainer |
| `canUpdateChatConfig` | Owner, Admin, AgentMaintainer (for published configs) |
| `canPromptConfig` | Admin, config owner, matching role/group, or `shared: true` |

**Roles** are Azure app roles defined in environment variables (`APP_ROLE_*`).  
**Groups** are Entra group IDs passed in the EasyAuth claims.  
**Shared configs:** Any authenticated user can prompt a config with `shared: true`, regardless of type or ownership. This is intentional — see `docs/adr/0002-shared-link-policy.md`.
```

- [ ] **Step 1.3: Fix the Type System section**

Replace the entire "## Type System" section with:

```markdown
## Type System

Domain types are plain TypeScript. Runtime validation lives only at external trust boundaries.

**Plain TypeScript types** (`src/lib/types/`):
- `ChatConfig`, `ChatRequest`, `Chat` — core domain types
- `AuthenticatedPrincipal` — user identity
- `ChatInputItem`, `ChatOutputItem` — message types
- `MuginSse` — SSE event discriminated union (Zod, used for stream validation)

**Validation layer** (`src/lib/validation/`):
- `parse-chat-config.ts` — validates incoming chat config bodies (uses `ChatConfigSchema`)
- `parse-chat-request.ts` — validates `/api/chat` request bodies (plain type guards)
- `auth-principal.ts` — validates EasyAuth claims (plain type guards)
- `transcription.ts` — validates transcription route request bodies (Zod)
- `env.ts` — validates required environment variables at startup

**Principle:** TypeScript is sufficient for internal code once inputs are validated. Zod is used only where a structured schema adds real value (discriminated unions, complex nested validation). See `docs/adr/0001-validation-strategy.md`.

### Core Types

| Type | Description | Location |
|------|-------------|----------|
| `ChatConfig` | Chat configuration (vendor, model, instructions) | [chat.ts](src/lib/types/chat.ts) |
| `ChatRequest` | Request payload with config and inputs | [chat.ts](src/lib/types/chat.ts) |
| `ChatResponseObject` | Complete response with outputs and usage | [chat.ts](src/lib/types/chat.ts) |
| `ChatInputMessage` | User/system input message | [chat-item.ts](src/lib/types/chat-item.ts) |
| `ChatOutputMessage` | Assistant output message | [chat-item.ts](src/lib/types/chat-item.ts) |
| `MuginSse` | SSE event discriminated union | [streaming.ts](src/lib/types/streaming.ts) |
| `AuthenticatedPrincipal` | User identity with roles/groups | [authentication.ts](src/lib/types/authentication.ts) |
```

- [ ] **Step 1.4: Fix the Project Structure section**

Replace the project structure block with:

```markdown
### Project Structure

```
src/
├── lib/
│   ├── types/                    # Plain TypeScript domain types
│   │   ├── AIVendor.ts           # Vendor interface
│   │   ├── chat.ts               # Chat request/response types
│   │   ├── chat-item.ts          # Message types
│   │   ├── chat-item-content.ts  # Content types (text, file, image)
│   │   ├── streaming.ts          # SSE event types (Zod discriminated union)
│   │   └── authentication.ts     # Auth types
│   ├── validation/               # Runtime validators (called at trust boundaries only)
│   │   ├── parse-chat-config.ts  # Chat config body parser
│   │   ├── parse-chat-request.ts # /api/chat body parser
│   │   ├── auth-principal.ts     # EasyAuth claim parser
│   │   ├── transcription.ts      # Transcription route body schemas
│   │   └── env.ts                # Startup env validation
│   ├── server/                   # Server-only code
│   │   ├── ai-vendors.ts         # Vendor factory (lazy singletons)
│   │   ├── services/             # Business logic orchestration
│   │   │   └── chat-config-service.ts
│   │   ├── openai/               # OpenAI vendor implementation
│   │   ├── mistral/              # Mistral vendor implementation
│   │   ├── ollama/               # Ollama vendor implementation
│   │   ├── litellm/              # LiteLLM vendor implementation
│   │   ├── transcription/        # Transcription job management
│   │   ├── auth/                 # EasyAuth integration
│   │   ├── middleware/           # HTTP middleware (auth, error handling)
│   │   └── db/                   # Database abstraction (mock + MongoDB)
│   ├── client/                   # Client-only utilities
│   │   └── chat/                 # Chat API client and request builders
│   ├── components/               # Svelte components
│   │   └── Chat/                 # Chat UI (ChatState, PostChatMessage, etc.)
│   ├── authorization.ts          # Access control functions
│   └── streaming.ts              # SSE utilities (buffered parser)
├── routes/
│   ├── +layout.server.ts         # Root auth injection
│   ├── api/
│   │   ├── chat/+server.ts       # POST /api/chat (streaming + non-streaming)
│   │   ├── chatconfigs/          # GET, POST, PUT, DELETE chat configs
│   │   └── transcription/        # Transcription job lifecycle
│   ├── agents/                   # Agent management pages
│   └── transcription/            # Transcription UI page
```
```

- [ ] **Step 1.5: Fix the API Reference section**

Replace the API Reference section with:

```markdown
## API Reference

### Chat

**`POST /api/chat`** — Send a message and receive an AI response.

Request body: `ChatRequest` (see `src/lib/types/chat.ts`).  
Response: `ReadableStream` (SSE) when `stream: true`, or `ChatResponseObject` JSON.

### Chat Configs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/chatconfigs` | List accessible chat configs |
| `POST` | `/api/chatconfigs` | Create a new chat config |
| `PUT` | `/api/chatconfigs/[_id]` | Replace a chat config |
| `DELETE` | `/api/chatconfigs/[_id]` | Delete a chat config |

### Transcription

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/transcription` | List transcription jobs for the authenticated user |
| `POST` | `/api/transcription` | Create a pending transcription job |
| `PATCH` | `/api/transcription` | Trigger processing of a pending job |
| `DELETE` | `/api/transcription` | Delete a job and its uploaded files |
| `PUT` | `/api/transcription/upload/[userId]/[jobId]/[filename]` | Upload audio file to Copyparty |
| `GET` | `/api/transcription/[id]/download` | Download completed transcription docx |
| `POST` | `/api/transcription/callback` | Webhook for tale-til-notat completion events |
```

- [ ] **Step 1.6: Fix the Production Environment Variables section**

Replace the stale production env section:

```markdown
### Production Environment Variables

```bash
# Required: AI provider keys (at least one)
MISTRAL_API_KEY_PROJECT_DEFAULT="..."
OPENAI_API_KEY_PROJECT_DEFAULT="..."

# Required: Database
MONGODB_CONNECTION_STRING="mongodb+srv://..."
MONGODB_DB_NAME="hugin"

# Required: Application roles (must match Azure app role values)
APP_ROLE_EMPLOYEE="Employee"
APP_ROLE_STUDENT="Student"
APP_ROLE_EDU_EMPLOYEE="EduEmployee"
APP_ROLE_ADMIN="Admin"
APP_ROLE_AGENT_MAINTAINER="AgentMaintainer"

# Required: Transcription (if transcription feature is enabled)
COPYPARTY_BASE_URL="https://copyparty.example.com"
TALE_TIL_NOTAT_URL="https://tale-til-notat.example.com"
TRANSCRIPTION_CALLBACK_SECRET="<random-secret>"

# Optional: Multi-project OpenAI keys
OPENAI_API_KEY_PROJECT_<NAME>="..."

# Security: MOCK_AUTH must NOT be set in production
# The app will refuse to start if MOCK_AUTH=true unless BUILD_PLACEHOLDER_CONFIG=true
```
```

- [ ] **Step 1.7: Run lint check (markdown formatting)**

```bash
npm run check
```

Expected: 0 errors (README changes don't affect TypeScript).

---

### Task 2: Write ADRs

**Files:**
- Create: `docs/adr/0001-validation-strategy.md`
- Create: `docs/adr/0002-shared-link-policy.md`

- [ ] **Step 2.1: Create the docs/adr directory and write ADR-0001**

Create `docs/adr/0001-validation-strategy.md`:

```markdown
# ADR-0001: Runtime Validation Only at Trust Boundaries

## Status
Accepted — implemented May 2026

## Context
The codebase originally used a "Zod-first" approach where Zod schemas were the primary way to define all types, with TypeScript types inferred from schemas. This created maintenance overhead (schema drift, `schemaForType` workaround) and coupled domain type files to a runtime library.

## Decision
Domain types are plain TypeScript. Runtime validation (Zod or plain type guards) is used only where external, untrusted data enters the system.

**Runtime validation is required at:**
- API request bodies (`/api/chat`, `/api/chatconfigs`, `/api/transcription`)
- EasyAuth `X-MS-CLIENT-PRINCIPAL` header
- SSE events parsed from vendor streams
- Environment variables at startup

**Runtime validation is not needed for:**
- Internal function calls between trusted modules
- Domain objects constructed inside trusted code
- Props flowing between Svelte components (server-loaded, already validated)

## Current implementation
| Boundary | Validator | Location |
|----------|-----------|----------|
| `/api/chat` body | Plain type guards | `src/lib/validation/parse-chat-request.ts` |
| `/api/chatconfigs` body | Zod (`ChatConfigSchema`) | `src/lib/validation/parse-chat-config.ts` |
| Transcription route bodies | Zod | `src/lib/validation/transcription.ts` |
| EasyAuth claims | Plain type guards | `src/lib/validation/auth-principal.ts` |
| SSE events | Zod discriminated union | `src/lib/types/streaming.ts` |
| Environment variables | Plain checks | `src/lib/validation/env.ts` |

## Zod placement rule
Zod schemas live in `src/lib/validation/` or `src/lib/types/streaming.ts`. They must not be defined inside route files or domain type files.

## Alternatives considered
- **Zod everywhere:** Rejected — excessive maintenance overhead, `schemaForType` workaround was a code smell
- **No runtime validation:** Rejected — external inputs from users, vendors, and Azure cannot be trusted
- **Replace Zod entirely with plain guards:** Possible in future. Not done now because Zod handles the complex nested shapes well and the tests prove its behavior.
```

- [ ] **Step 2.2: Write ADR-0002**

Create `docs/adr/0002-shared-link-policy.md`:

```markdown
# ADR-0002: Shared Config Access Policy

## Status
Accepted — behavior documented May 2026, not yet changed

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
```

- [ ] **Step 2.3: Run check**

```bash
npm run check
```

Expected: 0 errors.

---

### Task 3: Update REFACTOR_PLAN.md

**Files:**
- Modify: `REFACTOR_PLAN.md`

- [ ] **Step 3.1: Add dated progress entry**

Append before "Definition of done":

```markdown
### 2026-05-21 — Phase 9: Documentation

Completed:

- Updated `README.md`: fixed stale "Zod-first" type system description, corrected authentication section (plain type guards, not Zod), fixed authorization section with role table, updated project structure to include `validation/`, `services/`, `client/` directories, fixed API reference (`PUT` not `PATCH` for chat configs), added transcription API table, fixed production env vars.
- Created `docs/adr/0001-validation-strategy.md`: documents the boundary-only validation decision, where each boundary is validated, and the Zod placement rule.
- Created `docs/adr/0002-shared-link-policy.md`: documents the intentional `shared: true` access behavior, its risks, and deferred alternatives.

Verified:

- `npm run check` reports 0 errors and 0 warnings.
- `npm run test` passes.
```

---

## Self-Review

**Spec coverage:**
- ✅ Fix stale "Zod-first" type system in README → Task 1 step 1.3
- ✅ Fix authentication description (plain guards, not Zod) → Task 1 step 1.1
- ✅ Fix authorization section with role table → Task 1 step 1.2
- ✅ Fix project structure (add `validation/`, `services/`, `client/`) → Task 1 step 1.4
- ✅ Fix API reference (`PUT` not `PATCH`, add transcription) → Task 1 step 1.5
- ✅ Fix production env vars → Task 1 step 1.6
- ✅ ADR-0001: validation strategy → Task 2 step 2.1
- ✅ ADR-0002: shared link policy → Task 2 step 2.2
- ✅ Update REFACTOR_PLAN.md → Task 3

**Placeholder scan:** None found. All markdown content is complete.

**Type consistency:** N/A — documentation only.
