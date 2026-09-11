# Hugin Beta

A multi-provider AI chat application built with SvelteKit, providing a unified interface to multiple AI providers with enterprise-grade authentication and real-time streaming responses.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.57-orange.svg)](https://kit.svelte.dev/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5.55-red.svg)](https://svelte.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Hugin Beta is an internal AI-agent web application designed to provide a democratic, secure, flexible, and user-friendly AI solution. The application supports multiple AI providers through a vendor-agnostic architecture, ensuring built-in privacy and seamless user experience.

### Key Features

- **Multi-Provider Support** - Unified interface for OpenAI, Mistral AI, Ollama, and LiteLLM
- **Real-Time Streaming** - Server-Sent Events (SSE) for incremental AI responses
- **Enterprise Authentication** - Microsoft Entra ID integration with role-based and group-based access control
- **Multi-Modal Input** - Support for text, images, and document uploads
- **Canvas** - AI-assisted document editor with web search, manual editing, Mermaid diagram generation, and export to text and Word
- **Transcription (Tale-til-notat)** - Audio upload and transcription via an internal service, with group-gated sensitive use cases
- **Datakilder** - Three kinds of data sources an agent can use: RAG document libraries (retrieval, injected into `instructions`), SharePoint MCP sources (scoped folder browsing/reading via tool-calling), and Website sources (scoped page fetching via tool-calling) - each with its own tab, private-by-default ownership, and an explicit "make public" toggle to share with other users
- **Conversation Persistence** - Optional history with auto-generated titles, incognito mode, and at-rest encryption
- **Agent Management** - Create, publish, and share reusable chat configurations ("agents")
- **Modern UI** - Svelte 5 Runes for reactive state management with markdown and LaTeX rendering

---

## Table of Contents

- [Architecture](#architecture)
  - [System Overview](#system-overview)
  - [Vendor Abstraction](#vendor-abstraction)
  - [Authentication Flow](#authentication-flow)
  - [Streaming Architecture](#streaming-architecture)
  - [Authorization](#authorization)
- [Features](#features)
  - [Canvas](#canvas)
  - [Transcription (Tale-til-notat)](#transcription-tale-til-notat)
  - [Datakilder (RAG)](#datakilder-rag)
  - [SharePoint MCP Integration](#sharepoint-mcp-integration)
  - [Website Data Sources](#website-data-sources)
  - [Conversation History & Encryption](#conversation-history--encryption)
  - [Agent Management](#agent-management)
  - [Feature Spotlight](#feature-spotlight)
  - [Analytics](#analytics)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
- [Development](#development)
  - [Commands](#commands)
  - [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Type System](#type-system)
- [Testing](#testing)
- [Deployment](#deployment)
- [License](#license)

---

## Architecture

### System Overview

Hugin Beta follows an API-first architecture where all frontend capabilities are backed by corresponding backend APIs. The application is built as a SvelteKit monolith with clear separation between client and server code.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Chat.svelte │  │ ChatState   │  │ SSE Stream Consumer     │ │
│  │ (UI)        │◄─┤ (Svelte 5)  │◄─┤ (PostChatMessage)       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/SSE
┌────────────────────────────▼────────────────────────────────────┐
│                        Server Layer                             │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Auth Middleware │─►│ API Routes   │─►│ Vendor Factory    │  │
│  │ (Entra ID)      │  │ (/api/chat)  │  │ (ai-vendors.ts)   │  │
│  └─────────────────┘  └──────────────┘  └─────────┬─────────┘  │
└───────────────────────────────────────────────────┼─────────────┘
                                                    │
┌───────────────────────────────────────────────────▼─────────────┐
│                      AI Provider Layer                          │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│  │  OpenAI   │ │ Mistral AI│ │  Ollama   │ │  LiteLLM  │        │
│  │  Vendor   │ │  Vendor   │ │  Vendor   │ │  Vendor   │        │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Vendor Abstraction

The application uses a plugin-based vendor pattern. All AI providers implement the `IAIVendor` interface:

```typescript
interface IAIVendor {
  createChatResponse(chatRequest: ChatRequest): Promise<ChatResponseObject>
  createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream>
}
```

Four vendors are implemented today: OpenAI, Mistral AI, Ollama, and LiteLLM (`src/lib/server/{openai,mistral,ollama,litellm}/`), each following the same three-file pattern:

| File | Purpose |
|------|---------|
| `{vendor}-vendor.ts` | Implements `IAIVendor` interface |
| `{vendor}-mapping.ts` | Converts between internal types and vendor SDK types |
| `{vendor}-stream.ts` | Handles SSE streaming and event normalization |

Vendors are registered in `src/lib/server/ai-vendors.ts` and enabled/configured per-vendor via `APP_CONFIG.VENDORS` (`src/lib/server/app-config/app-config.ts`). **`vendorId` values are uppercase** (`"OPENAI"`, `"MISTRAL"`, `"OLLAMA"`, `"LITELLM"`), matching the `VENDORS` keys in `APP_CONFIG`.

**Data Flow:**
```
ChatRequest → Mapping Layer → Vendor SDK → Vendor Response → Mapping Layer → ChatResponse
```

### Authentication Flow

**Production (Microsoft Entra ID):**
1. Azure App Service EasyAuth validates JWT token
2. Claims passed via `X-MS-CLIENT-PRINCIPAL` header (base64-encoded)
3. `src/lib/server/auth/get-authenticated-user.ts` decodes the header and parses claims with **hand-written type guards** — not Zod. A Zod schema (`AuthenticatedPrincipalSchema` in `src/lib/types/authentication.ts`) exists but is currently used only for `z.infer` to derive the TypeScript type, not for runtime validation
4. `AuthenticatedPrincipal` object created with userId, name, roles, and groups

**Development (Mock Authentication):**
- Enabled via `MOCK_AUTH="true"` environment variable
- Roles and groups configurable via environment variables

### Streaming Architecture

Real-time AI responses use Server-Sent Events with the following event types:

| Event | Description |
|-------|-------------|
| `response.config` | Chat configuration metadata |
| `response.started` | Response initiated with responseId |
| `response.output_text.delta` | Incremental text chunk |
| `response.searching` | Web search in progress |
| `response.annotations` | URL citations from web search |
| `response.done` | Completion with token usage statistics |
| `response.error` | Error information |
| `conversation.created` | New conversation identifier |
| `hugin_conversation.created` | Internal Hugin conversation id (`huginConversationId`), used for persisted history |

All events are validated using Zod discriminated unions (`MuginSse` in `src/lib/types/streaming.ts`) for type-safe handling — this is one of the few places in the codebase where Zod defines the primary type (see [Type System](#type-system)).

---

### Authorization

All access-control decisions go through named functions in `src/lib/authorization.ts`, taking the `AuthenticatedPrincipal` (and usually `AppRoles`/`AppConfig`) and returning a boolean:

| Function | Grants access when... |
|----------|------------------------|
| `canViewAllChatConfigs` | user has the `ADMIN` role |
| `canEditPredefinedConfig` | `AGENT_MAINTAINER` or `ADMIN` |
| `canPublishChatConfig` | `AGENT_MAINTAINER` or `ADMIN` |
| `canEditChatConfig` | new config (`_id === ""`), `ADMIN`, `AGENT_MAINTAINER` on a published config, or the private config's own creator |
| `canUpdateChatConfig` | same as above, plus validates the existing/incoming config `_id`s match before checking |
| `canPromptConfig` | `ADMIN`; a `shared` config; a private config owned by the user; or a published config matching the user's role/group via `accessGroups` (`"all"`, `"employee"`, `"edu_employee"`, `"student"`, or an explicit Entra group id) |
| `canUseCanvas` | `EMPLOYEE` or `ADMIN` |
| `canUseRagservice` | `EMPLOYEE` or `ADMIN` |
| `canUseMcpSharepoint` | `EMPLOYEE` or `ADMIN` - can use the MCP feature at all (see one below for per-source ownership) |
| `canUseWebsiteDataSource` | anyone authenticated, students included - Website sources touch no live external system or org-wide search, so there's no role gate beyond being logged in (see one below for per-source ownership) |
| `canViewMcpSource` / `canViewWebsiteSource` | `ADMIN`; the source's own `type === "published"`; or the source's creator |
| `canEditMcpSource` / `canEditWebsiteSource` | `ADMIN`, or the source's creator - regardless of `type` (a published source is still owner/admin-only to edit or delete) |
| `isStudentOnly` | `STUDENT` is the user's *only* role (a user who is both `STUDENT` and `EDU_EMPLOYEE` does not count) |
| `canUseHistory` | anyone except a student-only user — students are always forced into incognito, no history is ever stored |
| `canSeeSpotlight` | audience gate for [Feature Spotlight](#feature-spotlight) announcements; uses the same `accessGroups` semantics as `canPromptConfig` |

Regular users can define their own chat configs and test them against `/api/chat`, but cannot create configs pointing at predefined agent/prompt IDs configured in a vendor — those are only usable via a predefined chat config in the database, created by a user with `AGENT_MAINTAINER` or `ADMIN` permissions. Transcription access is currently gated separately from this table — see [Transcription](#transcription-tale-til-notat).

---

## Features

### Canvas

Canvas is an AI-assisted document editor available at `/canvas/document`. It lets users create and refine markdown documents through natural language prompts, with optional web search for sourcing content.

**How it works:**

1. User writes a prompt describing what they want (e.g. "Write a job application for a summer position at a campsite")
2. The AI generates or modifies the document and streams the result back in real time
3. User can continue refining via further prompts, or switch to manual edit mode to edit the raw markdown directly
4. Sources from web search are automatically appended as a `## Kilder` section with numbered links

**Features:**

- Real-time streaming response via SSE
- Toggle between rendered preview and raw markdown editing
- Web search toggle — enables live internet sourcing, with citations appended to the document
- Export to `.txt` or `.docx` (with proper heading, bold, italic, bullet, and horizontal rule formatting)
- Mermaid diagram generation and editing via a separate endpoint (`POST /api/canvas/mermaid`)
- Hardcoded to OpenAI `gpt-5.6-terra` — no model selection needed

**Access control:**

Canvas is gated behind the `CANVAS_ENABLED` environment variable and requires the `EMPLOYEE` or `ADMIN` role. Both the page load and the API endpoint enforce this independently.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/routes/canvas/+layout.server.ts` | Auth/feature-flag gate (shell) |
| `src/routes/canvas/+layout.svelte` | Shell frame + conditional tool tab strip |
| `src/routes/canvas/document/+page.svelte` | Document editor UI — editor, prompt bar, export |
| `src/routes/canvas/PromptBar.svelte` | Prompt input component |
| `src/routes/canvas/tools.ts` | Tool registry |
| `src/routes/api/canvas/+server.ts` | POST endpoint — streams AI response |
| `src/lib/types/canvas.ts` | Canvas request type (plain TypeScript) |

---

### Transcription (Tale-til-notat)

Audio-to-text transcription via an internal service ("tale-til-notat"), available at `/transcription`. Users upload an audio/video file, the app proxies it to an internal Copyparty file server, triggers transcription, and polls/receives a callback with the result.

**How it works:**

1. User selects a file (accepted: `.mp3`, `.mp4`, `.wav`, `.m4a`, `.ogg`, `.webm`, `.flac`, `.mkv`, `.avi`, `.wma`) and a mode — "open" or "red" (sensitive use case)
2. The app creates a job, proxies the upload to Copyparty, and triggers the external transcription service with a callback URL
3. The external service calls back `POST /api/transcription/callback` (secret-gated via `TRANSCRIPTION_CALLBACK_SECRET`) when done
4. The finished transcription can be downloaded as a `.docx`

**Access control:** "Red" (sensitive) use cases are gated by Entra ID group membership — `TRANSCRIPTION_GROUP_N_ID`/`TRANSCRIPTION_GROUP_N_LABEL` env vars (dynamically scanned, `N = 1, 2, 3, …`) define the available groups, checked against the user's Entra groups.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/routes/transcription/+page.svelte` | UI — job list, upload, mode toggle, download, delete |
| `src/routes/api/transcription/+server.ts` | Create/list/update transcription jobs |
| `src/routes/api/transcription/callback/+server.ts` | Secret-gated webhook called by the external service |
| `src/routes/api/transcription/[id]/download/+server.ts` | Download a finished transcription as `.docx` |
| `src/routes/api/transcription/upload/[...path]/+server.ts` | Proxies large audio uploads to Copyparty |
| `src/lib/server/transcription/job-store.ts` | In-memory job store — **jobs do not survive a restart or work across instances** |
| `src/lib/server/transcription/tale-til-notat.ts` | Calls the external transcription service |
| `src/lib/server/transcription/types.ts` | Zod schemas for job/callback payloads |

---

### Datakilder (RAG)

*Actively under development.* The "Datakilder" area at `/datasources` has three tabs, one per kind of data source an agent can be given: **Dokumentsøk** (RAG, `/datasources/ragservice` - this section), **MCP** (`/datasources/mcp` - see [SharePoint MCP Integration](#sharepoint-mcp-integration)), and **Websites** (`/datasources/web` - see [Website Data Sources](#website-data-sources)). `/ragservice` (the old, pre-tabs URL) redirects to `/datasources/ragservice` for old bookmarks/links.

The three tabs don't share one audience: Dokumentsøk and MCP are `EMPLOYEE`/`ADMIN`-only, but Websites is open to everyone, students included (see each tab's own Access control note below). The "Datakilder" menu link and the bare `/datasources` index route reflect this - the menu link is always shown, and the index route redirects to Dokumentsøk for employees/admins or straight to Websites for anyone without access to that tab, rather than bouncing them off an access-denied page.

This section covers Dokumentsøk: lets `EMPLOYEE`/`ADMIN` users manage RAG data stores and have their retrieval results injected into an agent's `instructions` at prompt time.

Requests are proxied to an external ragservice through an on-behalf-of (OBO) token exchange — Hugin's own Entra app registration (`ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`) exchanges the user's token for one scoped to the ragservice, rather than the user talking to it directly. RAG stores/access are entirely managed by that external ragservice - unlike the MCP and Website sources below, there is no separate Hugin-native ownership/visibility model for them.

**Access control:** Gated by `canUseRagservice` (`EMPLOYEE` or `ADMIN`).

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/routes/datasources/+layout.svelte` | Shared tab strip (Dokumentsøk/MCP/Websites) |
| `src/routes/datasources/ragservice/+page.svelte` | UI — data store management |
| `src/routes/api/obo/rag/[...path]/+server.ts` | OBO token exchange + proxy to the external ragservice |
| `src/lib/ragservice/components/` | Data store, chunk, file upload, access, and settings components |
| `src/lib/ragservice/adapters/ragserviceApi.ts` | Client for the external ragservice API |
| `src/lib/server/ragservice/get-rag-token.ts` | OBO token exchange logic |

---

### SharePoint MCP Integration

Read-only, **scoped** access to SharePoint via a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server, managed at `/datasources/mcp` as named **MCP-kilder** (`McpSource`) and selectable (one or more per assistant) in the same Datakilder picker used for RAG libraries. Modeled as a discriminated union on `server` - `"sharepoint"` is the only option today, but the type/UI already have room for a second MCP server later without a redesign.

Each source has:
- **Folders** - a list of `{ value, matchType: "exact" | "prefix" }` entries (an empty-value prefix means the whole SharePoint area - a deliberate, explicitly-labelled checkbox in the form, never an accidental side effect of leaving a field blank). Picked via a built-in folder browser (calls the real server live) or typed by hand. Governs the document-library tools (`List_SharePoint_Folders`, `Get_SharePoint_Tree`, `List_SharePoint_Documents`, `Get_Document_Content`, `Get_File_Metadata`).
- **Lister** - a plain list of SharePoint list display names (e.g. `"Programmer"`), matched case-insensitively - no prefix/hierarchy concept, since SharePoint Lists (tabular/columned data - a wholly separate content type from document library folders/files) don't nest. Governs `Get_SharePoint_List_Items`. Picked via a built-in list browser (calls `List_SharePoint_Lists` live, admin-only - see below) or typed by hand.
- **Fritekst-søk** (`Search_SharePoint`) - off by default. This is org-wide full-text search with no folder scoping possible at all, so enabling it bypasses the folder list entirely; whether to offer it is an open question pending input from the MCP server's own owner.

**Scoping is enforced entirely on Hugin's side**, not the MCP server's (which has no scoping concept of its own - see `hugin-integration.md`). `src/lib/server/mcp/scoped-sharepoint-client.ts` wraps the real MCP client with an **allow-list** (not a block-list) of reviewed tool names: the five folder-scoped tools are validated against the folder list on every call (checking whichever of `parent_folder`/`folder_name` the tool actually uses, with boundary-safe prefix matching - a prefix `"Budsjett"` never matches a sibling folder like `"Budsjett 2"`); `Get_SharePoint_List_Items` is validated on every call against the `lists` allow-list (case-insensitive exact match on `list_name`, gated on the source having at least one configured list); `Search_SharePoint` is gated by the toggle above; `Download_Document` and `List_SharePoint_Lists` are never exposed to the model at all, regardless of scope. `List_SharePoint_Lists` in particular takes **no arguments whatsoever** (verified live, see `tmp/tools.json`) - it's site-wide, unscopable discovery, so exposing it to the model would leak every list's name on the site, not just the scoped ones; it's only ever called server-side, by the admin-only `sharepoint/lists` route backing the list picker in the source form (same trust level as the folder browser - an admin configuring a source already has to see everything to choose from). A rejected call names the actual allowed folders/lists back to the model, and a system-prompt nudge (`agentic-tool-guidance.ts`) tells it to use tools proactively and never guess names - both added after live testing showed a model would otherwise guess a plausible-sounding path instead of listing first.

**Ownership & visibility:** private by default (only the creator, or an admin, can see/select/edit/delete it) with an explicit "gjør offentlig" checkbox to share a source with every other user - mirrors `ChatConfig`'s own private/published + owner model (see `canViewMcpSource`/`canEditMcpSource`). Deliberately stricter than the pre-ownership version of this feature, added after every source was found to be visible to *and* editable/deletable by every employee on a shared (not just single-developer) deployment.

**Combines with Website sources in one shared agentic loop** (`combined-tool-client.ts`) - an assistant can have SharePoint MCP and Website sources (and RAG) all active at once; RAG retrieval still runs first and injects matched context into `instructions`, then the combined MCP+Website tool set is offered to the model in the same turn.

**Access control:** Gated by `canUseMcpSharepoint` (`EMPLOYEE` or `ADMIN`) - configuring sources, selecting them on an assistant, and actually using them in a chat all share this one gate.

**Key behaviours:**

- Read-only — the MCP server exposes SharePoint data retrieval tools only; no write operations.
- Manual-config assistants only — assistants that reference a predefined vendor agent config reject an `mcp` data source with HTTP 400.
- Supported vendors: OpenAI, Mistral, LiteLLM. Ollama is not supported.
- Service-identity auth (client credentials flow) — the application authenticates to the one shared MCP server using its own Entra ID service principal; no delegated per-user token is used, so a user can read whatever a selected source's scope allows regardless of their own personal SharePoint permissions.
- Access is gated by the existing assistant `accessGroups` RBAC: a user can only reach an MCP-enabled assistant if they are a member of one of the groups listed in that assistant's `accessGroups`.
- **Not available on the anonymous public embed route** (`/public/embed/api/chat`): that route strips `mcp` tools before the chat is dispatched, regardless of what an assistant's data sources include. This is deliberate — unlike RAG libraries (curated, presumed vetted for public-safe content when a maintainer opts an assistant into anonymous embedding), the MCP server is a live connection to internal SharePoint content, and the `accessGroups` RBAC that scopes MCP exposure elsewhere doesn't apply to anonymous visitors.

**Environment variables** (add to `.env` / Azure Application Settings) - one shared connection, not per-source:

```bash
MCP_SHAREPOINT_ENABLED="true"                  # Set to "true" to activate
MCP_SHAREPOINT_URL="https://..."               # MCP server base URL
MCP_SHAREPOINT_CLIENT_ID=""                    # App registration client ID
MCP_SHAREPOINT_CLIENT_SECRET=""               # App registration client secret
MCP_SHAREPOINT_TENANT_ID=""                   # Entra tenant ID
MCP_SHAREPOINT_SCOPE="api://.../.default"     # OAuth scope for the MCP server
```

When `MCP_SHAREPOINT_ENABLED` is absent or not `"true"`, the real SharePoint connection never gets attempted, and any chat that needs it degrades gracefully to a "not available" message. This is purely a server-side connection concern: already-created MCP sources still appear and remain selectable in the Datakilder picker either way - whether the connection behind them actually works is only checked when a chat using one is sent, not when picking a source for an assistant.

**Server-side setup** (app-role grant `SharePoint.MCP.Read`, secret rotation before Dec 2026): see [`hugin-integration.md`](hugin-integration.md) - note that document has been found to disagree with the real server on several points (parameter names, tool count, an invented parameter); where they conflict, trust the live-verified behaviour described above.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/routes/datasources/mcp/+page.svelte` | UI — MCP source management (`McpSourceList`/`McpSourceForm`) |
| `src/lib/mcp-sources/components/McpFolderBrowser.svelte` | Live folder browser backing the form |
| `src/lib/mcp-sources/components/McpListBrowser.svelte` | Live SharePoint list-name browser backing the form |
| `src/lib/mcp-sources/server/adapters/` | `IMcpSourceStore` + Mongo/mock adapters (own-folder convention, see `CLAUDE.md`) |
| `src/routes/api/mcp-sources/` | CRUD for sources + admin-only `sharepoint/browse` folder listing and `sharepoint/lists` list-name listing |
| `src/lib/server/mcp/scoped-sharepoint-client.ts` | Folder/list/tool allow-list enforcement |
| `src/lib/server/mcp/parse-tool-result-items.ts` | Shared defensive JSON-parsing for tool results with an uncertain/varying wrapping shape |
| `src/lib/server/mcp/parse-sharepoint-folder-list.ts` / `parse-sharepoint-list-names.ts` | Parse `List_SharePoint_Folders`/`List_SharePoint_Lists` results into the admin browsers' picker data |
| `src/lib/server/mcp/build-mcp-tool-clients.ts` | Resolves an assistant's selected sources into one scoped client |
| `src/lib/server/mcp/agentic-tool-guidance.ts` | System-prompt nudge appended when any agentic tool source is active |
| `src/lib/server/mcp/combined-tool-client.ts` | Merges MCP + Website tool clients into one for the same chat turn |
| `src/lib/server/mcp/mcp-config.ts` / `mcp-token.ts` / `mcp-client.ts` | Env vars, cached client-credentials token, connected MCP client singleton |
| `src/lib/server/mcp/mcp-tools.ts` | Neutral tool type + per-provider adapters |
| `src/lib/server/mcp/agentic-loop.ts` | Driver-agnostic agentic tool-calling loop |
| `src/lib/server/mcp/run-agentic-chat.ts` | Shared agentic chat entry point with graceful degradation (MCP and Website both use this) |
| `src/lib/server/mcp/drivers/` | Per-vendor tool drivers (OpenAI Responses, Mistral conversations, LiteLLM chat-completions) |
| `src/lib/authorization.ts` | `canUseMcpSharepoint`, `canViewMcpSource`, `canEditMcpSource` |
| `src/lib/validation/parse-chat-config.ts` | Rejects `mcp`/website data sources on predefined vendor-agent configs |
| `src/routes/public/embed/api/chat/+server.ts` | Strips `mcp` tools before dispatch on the anonymous embed route |

---

### Website Data Sources

Scoped access to specific web pages, managed at `/datasources/web` as named **Website-kilder** (`WebsiteSource`) and selectable (one or more per assistant) in the Datakilder picker. Unlike RAG, this is **not vectorized/indexed content** - it's a tool-calling capability (`browse_website`), similar in spirit to the built-in `web_search` tool but restricted to only the URLs/domains a source configures, and 100% Hugin-native (no external service, no env vars).

Each source has **entries** - a list of `{ value: URL, matchType: "exact" | "prefix" }`: `"exact"` allows only that one page; `"prefix"` allows a whole path/section (e.g. `https://example.no/buss/`) or, with a bare origin, an entire domain.

When called, the server fetches the page, converts it to plain text (`html-to-text`), and appends any same-scope links found on the page to the result - so a model working within a `"prefix"` source can navigate deeper (e.g. from a section front page into its sub-pages) across successive tool calls, one page at a time, never leaving the configured scope.

**Ownership & visibility, and combining with MCP/RAG**: identical model to SharePoint MCP sources above - private by default with an explicit "gjør offentlig" toggle (`canViewWebsiteSource`/`canEditWebsiteSource`), and Website + MCP (+ RAG) sources on the same assistant all become available in one shared agentic loop turn.

**Access control:** Gated by `canUseWebsiteDataSource` - unlike Dokumentsøk/MCP, this is open to *every* authenticated user, students included. Website sources touch no live external system and grant no org-wide search/document access - they're just admin-curated URLs a bot may fetch - so there's no role restriction beyond being logged in; the ownership/visibility model above (private-by-default + "gjør offentlig") still governs who can create, edit or delete a given source.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/routes/datasources/web/+page.svelte` | UI — Website source management (`WebsiteSourceList`/`WebsiteSourceForm`) |
| `src/lib/website-sources/server/adapters/` | `IWebsiteSourceStore` + Mongo/mock adapters |
| `src/routes/api/website-sources/` | CRUD for sources |
| `src/lib/server/website-tools/website-tool-client.ts` | The `browse_website` tool: fetch, HTML→text, scope-filtered link discovery |
| `src/lib/authorization.ts` | `canUseWebsiteDataSource`, `canViewWebsiteSource`, `canEditWebsiteSource` |

---

### Conversation History & Encryption

Conversations can be persisted so users can revisit earlier chats, with an auto-generated title and optional at-rest encryption for message content and titles/summaries.

- **History** — `canUseHistory` gates this: everyone except a student-only user (see [Authorization](#authorization)) — student conversations are never stored, forcing incognito mode everywhere, client and server.
- **Incognito** — any chat can opt out of persistence per-request (`store: false`), regardless of role.
- **Encryption** — optional; if `CONVERSATION_ENCRYPTION_KEYS`/`CONVERSATION_ENCRYPTION_ACTIVE_KEY` are unset, messages/titles/summaries are stored in plaintext. When set, encryption is keyed by a free-form "key version" string so keys can be rotated per environment.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/lib/conversationstore/server/conv_manager.ts` | Conversation persistence logic |
| `src/lib/conversationstore/server/message-encryption.ts` | At-rest encryption for messages/titles/summaries |
| `src/lib/conversationstore/server/adapters/` | Storage adapters (MongoDB, in-memory mock) |
| `src/routes/api/conversations/+server.ts` | List the user's stored conversations |
| `src/routes/api/conversations/[_id]/+server.ts` | Fetch one conversation's history |
| `src/routes/api/conversations/[_id]/title/+server.ts` | Fire-and-forget auto-title generation (no-ops if already titled) |

---

### Agent Management

The UI for creating, editing, and publishing the `ChatConfig`s referenced throughout [Authorization](#authorization) — available at `/agents`.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/routes/agents/+page.svelte` | List published/private agents |
| `src/routes/agents/[agentId]/+page.svelte` | Agent detail/edit view |
| `src/routes/agents/create/+page.svelte` | Agent creation flow |

---

### Feature Spotlight

A generic "hey, look at this new feature" callout for announcing changes to users. It's a non-blocking box with an icon, header, body text, and an optional subtext line, always paired with a "Ikke vis denne igjen" (don't show again) checkbox and a close button. Dismissal is self-managed — the component checks localStorage on mount and simply doesn't render if the user has already opted out, so callers don't need to wire up any `show`/`open` state themselves.

**Two components, split by concern:** `FeatureSpotlight.svelte` is the presentational box itself — content, positioning, dismissal — and stays agnostic about where its `active` gate or its data comes from, so it can be used standalone with hardcoded props (all the examples below do exactly that). `SpotlightHost.svelte` is the app-specific wiring on top: it owns the static `SPOTLIGHTS` registry, resolves each entry's audience via `canSeeSpotlight`, and renders one `FeatureSpotlight` per eligible entry — mounted once, globally, in `+layout.svelte`. For the common case (see "Adding an announcement" below) you never touch `FeatureSpotlight` or `canSeeSpotlight` directly — just add an entry to `SPOTLIGHTS`.

**Simple example** (defaults to a top-center splash, the common case):

```svelte
<script lang="ts">
	import FeatureSpotlight from "$lib/components/FeatureSpotlight.svelte"
</script>

<FeatureSpotlight
	id="canvas-feature-2026-08"
	icon="auto_awesome"
	header="Nytt: Kladdeboka"
	text="Nå kan du bruke Kladdeboka til å jobbe med lengre tekster sammen med KI-assistenten."
	subtext="Du finner den i menyen til venstre."
/>
```

`id` is required and must be unique per announcement — it's the key used to remember that this specific spotlight was dismissed. `placement` defaults to `"top-center"`, so the example above needs nothing else to show up top-center; pass e.g. `placement="bottom-right"` for a corner toast instead.

**Text formatting:** `text` supports a small set of Markdown — a blank line starts a new paragraph, a single line break becomes a `<br>`, and `**bold**`/`*italic*` work as usual:

```svelte
<FeatureSpotlight
	id="canvas-feature-2026-08"
	header="Nytt: Kladdeboka"
	text={"Nå kan du bruke Kladdeboka til å jobbe med lengre tekster.\nStøtter **fet** og *kursiv* tekst.\n\nOg flere avsnitt om nødvendig."}
/>
```

This is rendered through its own small `markdown-it` instance (`src/lib/formatting/simple-markdown-formatter.ts`), separate from the one used for chat/canvas content — so changing this doesn't affect how AI responses render. `header` and `subtext` are plain text, not Markdown.

**Pointing at real UI inline** (e.g. referencing the button an announcement is about, mid-sentence): embed a small `.spotlight-pill` span directly in `text`. `text` is rendered with `html: true`, so this flows inline with the surrounding sentence instead of sitting in its own block:

```svelte
<FeatureSpotlight
	id="history-feature-2026-08"
	header="Nytt: Historikk"
	text={'Du finner tidligere samtaler under <span class="spotlight-pill"><span class="material-symbols-rounded">history</span>Samtaler</span> i toppmenyen.'}
/>
```

`.spotlight-pill` is deliberately styled *unlike* a real button (no pointer cursor, no hover state, a subtle background instead of the transparent-hover-highlight look real buttons have) — it's a reference chip saying "this is what to look for," not a clickable mimic that could confuse users into clicking it. `text` is standard Markdown throughout — this inline HTML isn't a separate mechanism layered on top, it's CommonMark's normal inline-HTML passthrough, just correctly left enabled.

**Restricting the audience:** not every announcement applies to every user (e.g. a conversation-history announcement is meaningless for student-only accounts, who never get history stored — see `isStudentOnly` in `src/lib/authorization.ts`). There's no dedicated prop for this — reuse the existing `active` gate with `canSeeSpotlight`, which shares the exact same `accessGroups` semantics as `ChatConfig.accessGroups`/`canPromptConfig`, so an announcement's audience is declared the same way an agent's audience is:

```svelte
<script lang="ts">
	import { canSeeSpotlight } from "$lib/authorization"
	import type { RoleAccessGroups } from "$lib/types/chat"

	const accessGroups: RoleAccessGroups[] = ["employee", "edu_employee"] // excludes "student"
</script>

<FeatureSpotlight
	...
	active={canSeeSpotlight(data.authenticatedUser, data.APP_CONFIG.APP_ROLES, accessGroups)}
/>
```

`canSeeSpotlight` always returns `true` for `ADMIN`, matching `canPromptConfig`'s convention.

**Dismissal behavior:**

- Closing via the X button only hides the box for the current page load.
- Checking "Ikke vis denne igjen" before closing persists the dismissal to `localStorage` (key `hugin_dismissed_spotlights`, a JSON array of ids) so it won't be shown again on that browser.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | — | Required. Unique key used to remember dismissal. |
| `header` | `string` | — | Required. Title text. |
| `text` | `string` | — | Required. Main body text. Supports a small set of Markdown — see "Text formatting" above. |
| `icon` | `string` | `undefined` | Optional [Material Symbol](https://fonts.google.com/icons) name shown in a round badge. |
| `subtext` | `string` | `undefined` | Optional smaller line below the main text. |
| `active` | `boolean` | `true` | One-way gate — set to `false` to keep it hidden regardless of dismissal state. |
| `backdrop` | `boolean` | `false` | Adds a subtle darken + blur behind the box. Off by default since most spotlights are non-blocking toasts; turn on for a more attention-grabbing splash (e.g. `placement="center"`/`"top-center"`). Purely visual — the backdrop doesn't dismiss the box on click, matching the checkbox/close-button-only dismissal model. |
| `placement` | `"center" \| "top-center" \| "top-right" \| "bottom-right" \| "bottom-center" \| "bottom-left" \| "top-left"` | `"top-center"` | Fixed screen position. |
| `onDismiss` | `() => void` | `undefined` | Called whenever the box is closed, whether or not "don't show again" was checked. |

**Not supported:** pinning the box next to a specific element, and multi-step guided tours — only fixed screen-corner placement. An earlier `anchor`/`anchorSide`/`anchorOffset` implementation was removed: it required `bind:this` wiring at every call site (tightly coupling the announcement to whatever element it pointed at) and still didn't handle auto-flipping near a viewport edge or an arrow pointing at the anchor. If element-pointing or guided tours become a real need, a proper library (e.g. `@floating-ui/dom` for positioning, or a dedicated tour library) is a better foundation than reviving this DIY version — see git history for reference if useful.

**Adding an announcement in this app:** to launch or update an announcement in hugin-beta specifically, add or edit an entry in the `SPOTLIGHTS` array in `src/lib/spotlights.ts` — `SpotlightHost.svelte` (mounted once in `src/routes/+layout.svelte`) loops over it, resolves each entry's `active` prop via `canSeeSpotlight`, and renders one `<FeatureSpotlight>` per eligible entry. There's no `<FeatureSpotlight>` markup to touch for the common case:

```ts
export const SPOTLIGHTS: SpotlightDefinition[] = [
	{
		id: "unique-id-2026-08",
		icon: "auto_awesome",
		header: "…",
		text: "…",
		accessGroups: ["employee", "edu_employee"] // omit for everyone
	}
]
```

As before, give an entry a new unique `id` whenever its copy changes, or users who dismissed the old copy won't see the update. Multiple entries can be active at once — each gets its own dismissal state — though nothing resolves visual overlap if two share the same fixed `placement`.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/lib/components/FeatureSpotlight.svelte` | The component |
| `src/lib/spotlights.ts` | Static array of announcement definitions — the thing to edit to launch/update one |
| `src/lib/components/SpotlightHost.svelte` | Loops the array, resolves `active` per entry via `canSeeSpotlight`, mounted once in `+layout.svelte` |
| `src/lib/util/spotlight-util.ts` | localStorage read/write for tracking dismissed spotlight ids |
| `src/lib/formatting/simple-markdown-formatter.ts` | Renders `text`'s Markdown subset (paragraphs, line breaks, bold, italic) |

---

### Analytics

Pageviews are tracked with [Plausible](https://plausible.io) — cookieless, no cross-site tracking, no personal data in the payload.

The snippet lives in `src/app.html` behind a `%plausible%` placeholder, which `src/hooks.server.ts` fills in via `transformPageChunk` — with the snippet when `PLAUSIBLE_SCRIPT_URL` is set, and with nothing when it isn't. The variable is deliberately set **on the prod app only**: test/beta and prod run the same build from the same repo, so a hardcoded snippet would file betatester traffic under the prod site's numbers.

The URL Plausible hands you already has the site id baked into the filename (`.../js/pa-<id>.js`), so there is no `data-domain` attribute to keep in sync:

```bash
PLAUSIBLE_SCRIPT_URL="https://plausible.io/js/pa-<site-id>.js"
```

Because it is read through `$env/dynamic/private`, flipping it needs an app-setting change and a restart — not a rebuild.

Keeping it in `app.html` rather than `<svelte:head>` matters here: `app.html` is the shell SvelteKit returns on every response, so the script is plain parser-inserted HTML even on `/` and `/agents/[agentId]`, which set `ssr = false`. Scripts in `<svelte:head>` are also subject to [known client-side-navigation quirks](https://github.com/sveltejs/kit/discussions/11940) that the shell sidesteps entirely.

Paths are reported as-is, which means `/agents/<agentId>` shows up per assistant. Agent ids are config ids rather than personal data, and the per-assistant breakdown is the useful part.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/app.html` | Holds the `%plausible%` placeholder |
| `src/hooks.server.ts` | Replaces the placeholder with Plausible's snippet when the env var is set |

---

## Getting Started

### Prerequisites

- **Node.js** - v22 (matches CI, see `.github/workflows/publish-*.yml`)
- **npm** - Package manager (included with Node.js)
- **API Keys** - At least one of: Mistral API key, OpenAI API key, or local Ollama instance

### Installation

```bash
# Clone the repository
git clone <your-repository-url>
cd hugin-beta

# Install dependencies
npm install
```

### Environment Configuration

Create a `.env` file in the project root:

```bash
# AI Provider API Keys (at least one required)
MISTRAL_API_KEY_PROJECT_DEFAULT="your-mistral-api-key"
OPENAI_API_KEY_PROJECT_DEFAULT="your-openai-api-key"
# OLLAMA_HOST / LITELLM_BASE_URL enable the Ollama / LiteLLM vendors if set

# Mock Database Configuration
MOCK_DB="true"                    # Use in-memory database (required for local dev)
# Or production Database Configuration
MONGODB_CONNECTION_STRING="mongodb+srv://..." # Production MongoDB connection
MONGODB_DB_NAME="mugin" # Name of database

# Conversation encryption (optional - if unset, messages/titles/summaries are stored in plaintext)
# Covers conversation-messages (userInput/response) and conversations (title/summary).
# Key versions are free-form strings (a counter, a date, "prod-1" - whatever helps you track rotations).
# Generate a key with: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
# Use a DIFFERENT keyset per environment (dev/prod) - each environment's own .env supplies its own.
CONVERSATION_ENCRYPTION_KEYS='{"2026-08":"<base64 of 32 random bytes>"}' # keyed by key version
CONVERSATION_ENCRYPTION_ACTIVE_KEY="2026-08" # which key version new writes are encrypted with

# Authentication
MOCK_AUTH="true"                  # Enable mock authentication for local development
MOCK_AUTH_ROLES="Employee,Admin"  # Comma-separated role values
MOCK_AUTH_GROUPS="group-id-123"   # Comma-separated group IDs
MOCK_AUTH_FORCE_401="false"       # Simulate an unauthenticated request (local testing only)
MOCK_AUTH_FORCE_403="false"       # Simulate an unauthorized request (local testing only)

# Application Roles
APP_ROLE_EMPLOYEE="Employee"
APP_ROLE_STUDENT="Student"
APP_ROLE_ADMIN="Admin"
APP_ROLE_AGENT_MAINTAINER="AgentMaintainer"
APP_ROLE_EDU_EMPLOYEE="eduemployee" # optional - defaults to "eduemployee" if unset

# Feature flags
CANVAS_ENABLED="true"             # Enable the Canvas document editor
DEFAULT_AGENT_ID=""                # Agent loaded by default on the home page

# Analytics - set on the prod app only (see the Analytics section)
PLAUSIBLE_SCRIPT_URL=""            # Plausible script URL; unset = no analytics

# Transcription (Tale-til-notat) - see the Transcription feature section
TALE_TIL_NOTAT_URL="http://<ki-server>:<port>"
COPYPARTY_BASE_URL="http://<copyparty-host>/copyparty"
TRANSCRIPTION_CALLBACK_SECRET="<random-secret>"
# Sensitive ("red") use case groups - define as many as needed (TRANSCRIPTION_GROUP_2_ID, _3_ID, ...)
TRANSCRIPTION_GROUP_1_ID=""
TRANSCRIPTION_GROUP_1_LABEL=""

# Datakilder (RAG) - see the Datakilder feature section
RAGSERVICE_URL="https://ragservice.example.com"
RAGSERVICE_SCOPE="api://<scope>/.default"
RAGSERVICE_TOKEN=""                # For local testing only - paste a token here
# Hugin's own Entra app registration, used for the on-behalf-of token exchange to ragservice
ENTRA_TENANT_ID=""
ENTRA_CLIENT_ID=""
ENTRA_CLIENT_SECRET=""

# Website data sources need no env vars at all - 100% Hugin-native, no external service.
# SharePoint MCP env vars are documented in the SharePoint MCP Integration section above.
```

> **`BODY_SIZE_LIMIT` gotcha:** `APP_CONFIG.BODY_SIZE_LIMIT_BYTES` only honours values ending in `M` (e.g. `"512M"`) — a raw byte count like `"536870912"` silently falls back to a 10 MB default. `adapter-node` reads the raw env var separately for its own request limit, so the two can disagree if you set a raw byte count.

---

## Development

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server at `http://localhost:5173` |
| `npm run dev -- --open` | Start dev server and open browser |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run full test suite (types, lint, build, unit tests) |
| `npm run test:unit` | Run Vitest unit tests only |
| `npm run test:unit -- --watch` | Run tests in watch mode |
| `npm run check` | TypeScript + Svelte type checking |
| `npm run lint` | Run Biome linter |
| `npm run lint:fix` | Auto-fix linting issues |

### Project Structure

```
src/
├── lib/                          # Shared library code
│   ├── types/                    # Domain types (mostly plain TS; Zod only at trust boundaries)
│   │   ├── AIVendor.ts          # Core vendor interface
│   │   ├── chat.ts              # Chat request/response types (+ ChatConfigSchema)
│   │   ├── chat-item.ts         # Message types
│   │   ├── chat-item-content.ts # Content types (text, file, image)
│   │   ├── streaming.ts         # SSE event types (Zod discriminated union)
│   │   ├── canvas.ts            # Canvas request type
│   │   └── authentication.ts    # Auth types
│   ├── validation/                # Boundary parse functions (plain TS guards → HTTPError)
│   ├── server/                    # Server-only code
│   │   ├── ai-vendors.ts        # Vendor factory
│   │   ├── openai/              # OpenAI implementation
│   │   ├── mistral/             # Mistral implementation
│   │   ├── ollama/              # Ollama implementation
│   │   ├── litellm/             # LiteLLM implementation
│   │   ├── ragservice/          # RAG on-behalf-of token exchange
│   │   ├── mcp/                 # SharePoint MCP: connection, scoping, shared agentic loop
│   │   ├── website-tools/       # Website source browse_website tool (fetch, HTML→text, links)
│   │   ├── transcription/       # Transcription job store + external service client
│   │   ├── auth/                # Authentication handlers
│   │   ├── middleware/          # HTTP middleware
│   │   ├── app-config/          # APP_CONFIG - vendors, models, roles, feature flags
│   │   └── db/                  # Database abstraction (IChatConfigStore only - see CLAUDE.md)
│   ├── conversationstore/         # Conversation persistence + at-rest encryption
│   ├── ragservice/                # Dokumentsøk UI components + API adapter (client-side)
│   ├── mcp-sources/                # MCP source UI + own server/adapters/ (per-feature store, see CLAUDE.md)
│   ├── website-sources/            # Website source UI + own server/adapters/
│   ├── components/                # Svelte components
│   │   └── Chat/                 # Chat UI components
│   ├── authorization.ts           # Access-control functions (see Authorization section)
│   ├── spotlights.ts               # Feature Spotlight announcement registry
│   └── streaming.ts               # SSE utilities
├── routes/                       # SvelteKit routes
│   ├── +layout.server.ts        # Root auth middleware
│   ├── +page.svelte             # Home page
│   ├── api/
│   │   ├── chat/+server.ts      # Chat streaming endpoint
│   │   ├── canvas/+server.ts    # Canvas streaming endpoint (+ mermaid/+server.ts)
│   │   ├── chatconfigs/         # Config CRUD endpoints
│   │   ├── conversations/       # Conversation history endpoints
│   │   ├── transcription/       # Transcription job + upload/download endpoints
│   │   ├── mcp-sources/         # MCP source CRUD + admin folder-browse proxy
│   │   ├── website-sources/     # Website source CRUD
│   │   └── obo/rag/             # On-behalf-of proxy to the external ragservice
│   ├── canvas/                  # Canvas document editor
│   ├── transcription/           # Tale-til-notat UI
│   ├── datasources/              # Datakilder tab shell (ragservice/mcp/web sub-routes)
│   ├── ragservice/               # Thin redirect to /datasources/ragservice (old bookmarks)
│   ├── agents/                  # Agent management pages
│   └── admin/                   # Admin pages
└── app.d.ts                     # Global type definitions
```

---

## API Reference

### POST `/api/chat`

Send a message and receive an AI response (streaming or non-streaming).

**Request Body:**
```typescript
{
  config: {
    _id: string,
    name: string,
    description: string,
    vendorId: "OPENAI" | "MISTRAL" | "OLLAMA" | "LITELLM",
    project: string,
    model?: string,
    instructions?: string,
    conversationId?: string
  },
  inputs: ChatInputItem[],
  stream?: boolean,
  store?: boolean
}
```

**Response:**
- **Streaming:** `ReadableStream` with `Content-Type: text/event-stream`
- **Non-streaming:** `ChatResponseObject` as JSON

### POST `/api/canvas`

Submit a prompt (and optionally the current document) to the AI document editor. Returns a streaming SSE response.

**Access:** Requires `CANVAS_ENABLED=true` and `EMPLOYEE` or `ADMIN` role.

**Request Body:**
```typescript
{
  document: string,       // Current document content (markdown). Empty string for new documents.
  prompt: string,         // Instruction for the AI (required, non-empty)
  webSearch?: boolean     // Enable web search (OpenAI vendor must be configured)
}
```

**Response:** `ReadableStream` with `Content-Type: text/event-stream`

Emits `response.output_text.delta` events with the updated document, and `response.annotations` events with URL citations when web search is used.

### POST `/api/canvas/mermaid`

Generate or edit a Mermaid diagram from a prompt. Same access control and streaming response shape as `/api/canvas`; hardcoded to OpenAI `gpt-5.6-terra`.

### GET / POST `/api/chatconfigs`

List, or create, chat configurations.

### PUT `/api/chatconfigs/[_id]`

Update an existing chat configuration.

### DELETE `/api/chatconfigs/[_id]`

Delete a chat configuration.

### GET `/api/conversations`

List the authenticated user's stored conversations.

### GET `/api/conversations/[_id]`

Fetch one conversation's full message history.

### POST `/api/conversations/[_id]/title`

Fire-and-forget: auto-generate a title for a conversation. No-op if the conversation is already titled.

### GET / POST / PATCH `/api/transcription`

List, create, or update transcription jobs. See [Transcription](#transcription-tale-til-notat).

### POST `/api/transcription/callback`

Webhook called by the external tale-til-notat service when a job completes. Authenticated via a shared secret (`TRANSCRIPTION_CALLBACK_SECRET`) query param, not user auth.

### GET `/api/transcription/[id]/download`

Download a finished transcription as a `.docx` file.

### `/api/transcription/upload/[...path]`

Proxies large audio/video uploads to the internal Copyparty file server.

### `/api/obo/rag/[...path]`

On-behalf-of token exchange, then proxies the request to the external ragservice. Gated by `canUseRagservice`. See [Datakilder](#datakilder-rag).

### `/api/mcp-sources`, `/api/mcp-sources/[_id]`

CRUD for MCP sources. GET/POST gated by `canUseMcpSharepoint`; list is filtered to the caller's own sources + everyone's published ones (`canViewMcpSource`, admin sees all); PUT/DELETE additionally require `canEditMcpSource` (owner or admin). See [SharePoint MCP Integration](#sharepoint-mcp-integration).

### `/api/mcp-sources/sharepoint/browse`

Admin-only, read-only proxy to `List_SharePoint_Folders` on the real MCP server, backing the folder-browser UI in the source form. Same gate as using MCP at all (`canUseMcpSharepoint`) - not stricter, since the underlying service credential already has that reach either way.

### `/api/website-sources`, `/api/website-sources/[_id]`

CRUD for Website sources - same shape as `/api/mcp-sources` above, gated by `canUseWebsiteDataSource`/`canViewWebsiteSource`/`canEditWebsiteSource`. Unlike `/api/mcp-sources`, `canUseWebsiteDataSource` is open to every authenticated user, not just `EMPLOYEE`/`ADMIN`. See [Website Data Sources](#website-data-sources).

---

## Type System

Domain types are **plain TypeScript**, not Zod schemas. Runtime validation with Zod is used only at a handful of external trust boundaries — API request bodies and the SSE event stream — where a discriminated-union validator genuinely earns its keep:

```typescript
// Most domain types: plain TypeScript, no Zod
type ChatConfig = {
  _id: string
  name: string
  vendorId: "OPENAI" | "MISTRAL" | "OLLAMA" | "LITELLM"
  model?: string
  // ...
}

// Zod used at a boundary - built from the plain type via schemaForType<T>(),
// not the other way around
const ChatConfigSchema = schemaForType<ChatConfig>()(z.object({ /* ... */ }))

// Boundary validation, in a route handler
const result = ChatConfigSchema.safeParse(requestBody)
```

Where Zod is used: `ChatConfigSchema` ([chat.ts](src/lib/types/chat.ts), validates incoming chat config bodies), `MuginSse` ([streaming.ts](src/lib/types/streaming.ts), validates SSE events from vendors), and transcription job/callback payloads ([types.ts](src/lib/server/transcription/types.ts)). `AuthenticatedPrincipalSchema` ([authentication.ts](src/lib/types/authentication.ts)) exists but is used only for `z.infer`, not runtime validation — see [Authentication Flow](#authentication-flow).

Everywhere else, validation is hand-written parse functions in `src/lib/validation/` (e.g. `parse-chat-config.ts`, `parse-canvas-request.ts`, `file-input.ts`) that throw `HTTPError(400)` on invalid input.

### Core Types

| Type | Description | Location |
|------|-------------|----------|
| `ChatConfig` | Chat configuration (vendor, model, instructions) | [chat.ts](src/lib/types/chat.ts) |
| `ChatRequest` | Request payload with config and inputs | [chat.ts](src/lib/types/chat.ts) |
| `ChatResponseObject` | Complete response with outputs and usage | [chat.ts](src/lib/types/chat.ts) |
| `ChatInputMessage` | User/system input message | [chat-item.ts](src/lib/types/chat-item.ts) |
| `ChatOutputMessage` | Assistant output message | [chat-item.ts](src/lib/types/chat-item.ts) |
| `MuginSse` | SSE event discriminated union (Zod) | [streaming.ts](src/lib/types/streaming.ts) |
| `AuthenticatedPrincipal` | User identity with roles/groups | [authentication.ts](src/lib/types/authentication.ts) |

---

## Testing

The project uses Vitest with separate test environments:

| Test Type | Location | Environment |
|-----------|----------|-------------|
| Client tests | `src/**/*.svelte.{test,spec}.ts` | Browser |
| Server tests | `tests/server/**/*.{test,spec}.ts` | Node.js |

```bash
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run tests in watch mode
npm run test:unit -- --watch
```

### Code Quality

Before committing, ensure all checks pass:

```bash
npm run test  # Runs: tsc → biome → build → vitest
```

**TypeScript Configuration** (`tsconfig.json`):
- `strict: true` - All strict checks enabled
- `noUncheckedIndexedAccess: true` - Prevents array access bugs
- `exactOptionalPropertyTypes: true` - Catches undefined/null issues

---

## Deployment

### Build

```bash
npm run build
```

The build uses `@sveltejs/adapter-node` for Node.js deployment. `npm run build` runs Vite in `--mode build`, which loads `.env.build` (placeholder values) rather than your local `.env` — real values are supplied by the deployment environment, not baked in at build time.

### Production Environment Variables

```bash
# Required
MONGODB_CONNECTION_STRING="mongodb+srv://..."
MONGODB_DB_NAME="mugin"
MISTRAL_API_KEY_PROJECT_DEFAULT="sk-..."
OPENAI_API_KEY_PROJECT_DEFAULT="sk-..."

# Authentication (Azure App Service)
MOCK_AUTH="false"

# Application Roles
APP_ROLE_EMPLOYEE="Employee"
APP_ROLE_STUDENT="Student"
APP_ROLE_ADMIN="Admin"
APP_ROLE_AGENT_MAINTAINER="AgentMaintainer"

# Feature flags
CANVAS_ENABLED="true"

# Analytics (prod app only)
PLAUSIBLE_SCRIPT_URL="https://plausible.io/js/pa-<site-id>.js"
```

### Azure Deployment

1. Configure Azure App Service with Node.js runtime
2. Enable EasyAuth with Microsoft Entra ID
3. Set environment variables in Application Settings
4. Deploy using your preferred method (Azure CLI, GitHub Actions, etc.)

---

## Technology Stack

| Category | Technology |
|----------|------------|
| Framework | SvelteKit 2.57, Svelte 5.55 |
| Language | TypeScript 5.9 |
| AI Providers | OpenAI, Mistral AI, Ollama, LiteLLM |
| Database | MongoDB (`mongodb` driver 7.x) |
| Validation | Zod 4.3 (boundary validation only — see [Type System](#type-system)) |
| Linting | Biome |
| Testing | Vitest |
| Markdown | markdown-it, highlight.js, KaTeX |
| Documents | `docx` (Canvas/Transcription export), `mermaid` (diagram generation), `pdf-lib` |
| Logging | `@vestfoldfylke/loglady` (structured logging) |

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by the Mugin Team of Vestfold and Telemark fylkeskommuner.
