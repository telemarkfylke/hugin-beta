# Hugin Beta

A multi-provider AI chat application built with SvelteKit, providing a unified interface to multiple AI providers with enterprise-grade authentication and real-time streaming responses.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.57-orange.svg)](https://kit.svelte.dev/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5.0-red.svg)](https://svelte.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Hugin Beta is an internal AI-agent web application designed to provide a democratic, secure, flexible, and user-friendly AI solution. The application supports multiple AI providers through a vendor-agnostic architecture, ensuring built-in privacy and seamless user experience.

### Key Features

- **Multi-Provider Support** - Unified interface for OpenAI, Mistral AI, Ollama, and LiteLLM
- **Real-Time Streaming** - Server-Sent Events (SSE) for incremental AI responses
- **Enterprise Authentication** - Microsoft Entra ID integration with role-based access control
- **Multi-Modal Input** - Support for text, images, and document uploads
- **Conversation History** - Server-side persistence of streamed chats, with incognito mode
- **Canvas** - AI-assisted document editor with web search, manual editing, and export to text and Word
- **Data Sources (RAG)** - Retrieval from configurable data stores, injected as chat context
- **Transcription** - Speech-to-note via an internal transcription service
- **Modern UI** - Svelte 5 Runes for reactive state management with markdown and LaTeX rendering

---

## Table of Contents

- [Architecture](#architecture)
  - [System Overview](#system-overview)
  - [Vendor Abstraction](#vendor-abstraction)
  - [Authentication Flow](#authentication-flow)
  - [Streaming Architecture](#streaming-architecture)
- [Features](#features)
  - [Conversation History](#conversation-history)
  - [Canvas](#canvas)
  - [Data Sources (RAG)](#data-sources-rag)
  - [Transcription](#transcription)
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
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐      │
│  │  OpenAI  │  │ Mistral AI │  │  Ollama  │  │ LiteLLM  │      │
│  │  Vendor  │  │   Vendor   │  │  Vendor  │  │  Vendor  │      │
│  └──────────┘  └────────────┘  └──────────┘  └──────────┘      │
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

Each vendor implementation consists of three components:

| File | Purpose |
|------|---------|
| `{vendor}-vendor.ts` | Implements `IAIVendor` interface |
| `{vendor}-mapping.ts` | Converts between internal types and vendor SDK types |
| `{vendor}-stream.ts` | Handles SSE streaming and event normalization |

**Data Flow:**
```
ChatRequest → Mapping Layer → Vendor SDK → Vendor Response → Mapping Layer → ChatResponse
```

### Authentication Flow

**Production (Microsoft Entra ID):**
1. Azure App Service EasyAuth validates JWT token
2. Claims passed via `X-MS-CLIENT-PRINCIPAL` header (base64-encoded)
3. `getAuthenticatedPrincipal()` base64-decodes the header, `JSON.parse`s it, and checks the required
   properties with hand-written guards (see `src/lib/server/auth/get-authenticated-user.ts`)
4. `AuthenticatedPrincipal` object created with userId, name, roles, and groups

Parsing throws if the `objectidentifier` or `name` claim is missing, or if the user has no roles.

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
| `conversation.created` | Vendor-side conversation identifier |
| `hugin_conversation.created` | Hugin-side conversation identifier (emitted by `/api/chat` when persisting) |

All events are validated using Zod discriminated unions for type-safe handling
(`MuginSse` in `src/lib/types/streaming.ts`).

---

### Authorization
- Uses the functions in authorization.ts
- Regular users can define their own chatConfigs and test basically any config against the api/chat endpoint
  - But they cannot define chatconfigs with predefined agent/prompt-ids where the config is set up in a vendor.
  - They can use predefined chatconfigs only if they have access to the agentId in some defined chatconfig in db - which is created by a user with more permissions.

---

## Features

### Conversation History

Chats can be persisted server-side so users can reload and continue them later.

**How it works:**

When a request arrives with `store: true`, `/api/chat` resolves (or creates) a conversation id, then
prepends the stored history to the request inputs. For streaming responses it calls `stream.tee()` —
one branch goes to the client, the other is consumed server-side, rebuilt into a full
`ChatResponseObject` from the same SSE events the client sees, and persisted once the stream ends.
The client is told which conversation it landed in via a `hugin_conversation.created` event.

**Incognito:** students never get persistence. `/api/chat` forces `store = false` for
student-only users server-side, regardless of what the client sent, because the incognito toggle is
only hidden client-side.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/lib/conversationstore/server/conv_manager.ts` | Conversation orchestration |
| `src/lib/conversationstore/server/adapters/` | Mock (in-memory) and MongoDB adapters |
| `src/routes/api/conversations/` | List, fetch, delete, and retitle conversations |

---

### Canvas

Canvas is an AI-assisted document editor available at `/canvas`. It lets users create and refine markdown documents through natural language prompts, with optional web search for sourcing content.

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
- Hardcoded to OpenAI `gpt-5.4` — no model selection needed

**Access control:**

Canvas is gated behind the `CANVAS_ENABLED` environment variable and requires the `EMPLOYEE` or
`ADMIN` role (`canUseCanvas()`). Both the page load and the API endpoint enforce this independently —
the page returns 404 when disabled, the endpoint returns 404 when disabled and 403 without the role.
If the OpenAI vendor is not configured, the endpoint returns 503.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/routes/canvas/+page.svelte` | Canvas UI — editor, prompt bar, export |
| `src/routes/canvas/+page.server.ts` | Page load with auth/feature-flag check |
| `src/routes/api/canvas/+server.ts` | POST endpoint — streams AI response |
| `src/lib/types/canvas.ts` | Zod request schema |

---

### Data Sources (RAG)

> ⚠️ **Actively under development.** Treat this section as an outline; the interfaces are still
> moving. Read the source for current behaviour rather than relying on this description.

Chat configs can reference external data stores. When a config has an active `datasource` tool,
`/api/chat` extracts the latest user message, queries the configured RAG stores, and appends the
matched text to the config's `instructions` as additional context before calling the vendor. The
internal `datasource` tool is then stripped from the request, since no vendor knows about it.

Access to the RAG service goes through an on-behalf-of token exchange, so retrieval runs with the
signed-in user's permissions rather than a service identity.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/lib/ragservice/` | Data store management UI and API client |
| `src/lib/server/ragservice/rag-search.ts` | Store querying used by `/api/chat` |
| `src/lib/server/ragservice/get-rag-token.ts` | On-behalf-of token exchange |
| `src/routes/api/obo/rag/[...path]/+server.ts` | Authenticated proxy to the RAG service |

---

### Transcription

Uploads audio for speech-to-text via an internal "tale-til-notat" service, then returns a formatted
note. Jobs are tracked in an in-memory store and the external service reports completion through a
callback endpoint authenticated with a shared secret.

Sensitive use cases (for example health or PPT) are gated on Entra ID group membership, configured
through numbered `TRANSCRIPTION_GROUP_N_ID` / `_LABEL` environment variables.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/routes/transcription/+page.svelte` | Transcription UI |
| `src/lib/server/transcription/job-store.ts` | In-memory job tracking |
| `src/lib/server/transcription/tale-til-notat.ts` | External service client |
| `src/routes/api/transcription/callback/+server.ts` | Completion callback |

> **Note:** the job store is in-memory, so jobs do not survive a restart and do not work across
> multiple instances.

---

## Getting Started

### Prerequisites

- **Node.js** - v22 (the deploy workflows build on `22.x`; there is no `engines` field to enforce it)
- **npm** - Package manager (included with Node.js)
- **API Keys** - At least one of: Mistral API key, OpenAI API key, LiteLLM gateway, or local Ollama instance

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

# Database - either MOCK_DB="true" for the in-memory store, or a real MongoDB.
# Anything other than MOCK_DB="true" requires MONGODB_CONNECTION_STRING, or startup throws.
MOCK_DB="true"                    # Use in-memory database (simplest for local dev)
MONGODB_CONNECTION_STRING="mongodb+srv://..." # Required unless MOCK_DB="true"
MONGODB_DB_NAME="mugin" # Name of database

# Authentication
MOCK_AUTH="true"                  # Enable mock authentication for local development
MOCK_AUTH_ROLES="Employee,Admin"  # Comma-separated role values
MOCK_AUTH_GROUPS="group-id-123"   # Comma-separated group IDs

# Application Roles
APP_ROLE_EMPLOYEE="Employee"
APP_ROLE_STUDENT="Student"
APP_ROLE_ADMIN="Admin"
APP_ROLE_AGENT_MAINTAINER="AgentMaintainer"

# Additional providers (optional)
OLLAMA_HOST="http://localhost:11434"  # Local Ollama instance
LITELLM_BASE_URL="https://..."        # LiteLLM gateway
LITELLM_API_KEY="..."

# Feature flags
CANVAS_ENABLED="true"                 # Enable the Canvas document editor
CONVERSATION_EXPORT_DISABLED="false"  # Hide conversation export
NEW_CHAT_CONFIRM_DISABLED="false"     # Skip the "start new chat?" confirmation
```

See `.env.example` for the full list, including the transcription and RAG service variables.

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
│   ├── types/                    # TypeScript types (Zod where validation is needed)
│   │   ├── AIVendor.ts          # Core vendor interface
│   │   ├── chat.ts              # Chat request/response types + ChatConfigSchema
│   │   ├── chat-item.ts         # Message types
│   │   ├── chat-item-content.ts # Content types (text, file, image)
│   │   ├── streaming.ts         # SSE event types (MuginSse)
│   │   ├── canvas.ts            # Canvas request schema
│   │   └── authentication.ts    # Auth types
│   ├── server/                   # Server-only code
│   │   ├── ai-vendors.ts        # Vendor factory
│   │   ├── openai/              # OpenAI implementation
│   │   ├── mistral/             # Mistral implementation
│   │   ├── ollama/              # Ollama implementation
│   │   ├── litellm/             # LiteLLM implementation
│   │   ├── app-config/          # APP_CONFIG + supported MIME types
│   │   ├── auth/                # Authentication handlers
│   │   ├── middleware/          # HTTP middleware
│   │   ├── ragservice/          # RAG token + search (server side)
│   │   ├── transcription/       # Transcription job store + client
│   │   └── db/                  # Database abstraction
│   ├── conversationstore/       # Conversation persistence (mock + Mongo adapters)
│   ├── ragservice/              # Data store UI + API client
│   ├── components/              # Svelte components
│   │   └── Chat/                # Chat UI components + ChatState
│   ├── validation/              # Boundary parsers (throw HTTPError 400)
│   ├── formatting/              # Markdown/KaTeX rendering
│   └── streaming.ts             # SSE utilities
├── routes/                       # SvelteKit routes
│   ├── +layout.server.ts        # Root auth middleware
│   ├── +page.svelte             # Home page
│   ├── api/
│   │   ├── chat/+server.ts      # Chat streaming endpoint
│   │   ├── canvas/+server.ts    # Canvas streaming endpoint
│   │   ├── chatconfigs/         # Config CRUD endpoints
│   │   ├── conversations/       # Conversation history endpoints
│   │   ├── transcription/       # Transcription job endpoints
│   │   └── obo/rag/             # On-behalf-of proxy to the RAG service
│   ├── canvas/                  # Canvas document editor
│   ├── ragservice/              # Data store management
│   ├── transcription/           # Transcription UI
│   ├── admin/                   # Admin pages
│   └── agents/                  # Agent management pages
└── app.d.ts                     # Global type definitions
```

---

## API Reference

### POST `/api/chat`

Send a message and receive an AI response (streaming or non-streaming).

**Request Body:** the `config` object is validated by `ChatConfigSchema`, so the fields below marked
required really are required — omitting `type`, `accessGroups`, `created`, or `updated` fails
validation.

```typescript
{
  config: {
    // required
    _id: string,
    name: string,
    description: string,
    vendorId: "OPENAI" | "MISTRAL" | "OLLAMA" | "LITELLM",  // uppercase - matches AppConfig keys
    project: string,
    type: "published" | "private",
    accessGroups: ("all" | "employee" | "edu_employee" | "student"
                   | { id: string, displayName: string })[],
    created: { at: string, by: { id: string, name?: string } },
    updated: { at: string, by: { id: string, name?: string } },

    // optional
    vendorAgent?: { id: string },   // predefined vendor-side agent; skips the model check
    model?: string,                 // required for manual configs (validated against APP_CONFIG)
    instructions?: string,
    conversationId?: string,
    shared?: boolean,
    tools?: { type: "web_search" | "datasource" }[] | null,
    dataSources?: { type: "ragservice", id: string }[] | null
  },
  inputs: ChatInputItem[],         // must be a non-empty array
  stream?: boolean,
  store?: boolean,                 // forced to false for student-only users
  huginConversationId?: string     // continue an existing persisted conversation
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

### `/api/chatconfigs`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/chatconfigs` | List chat configs visible to the signed-in user |
| `POST` | `/api/chatconfigs` | Create a new chat configuration |
| `PUT` | `/api/chatconfigs/[_id]` | Replace an existing chat configuration |
| `DELETE` | `/api/chatconfigs/[_id]` | Delete a chat configuration |

> Note: updates use `PUT`, not `PATCH`.

### `/api/conversations`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/conversations` | List the signed-in user's conversations |
| `GET` | `/api/conversations/[_id]` | Fetch one conversation with its history |
| `DELETE` | `/api/conversations/[_id]` | Delete a conversation |
| `POST` | `/api/conversations/[_id]/title` | Generate or set a conversation title |

### `/api/transcription`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/transcription` | List the user's transcription jobs |
| `POST` | `/api/transcription` | Submit a transcription job |
| `PATCH` | `/api/transcription` | Update a job |
| `DELETE` | `/api/transcription` | Delete a job |
| `PUT` | `/api/transcription/upload/[...path]` | Proxied upload of the audio file |
| `GET` | `/api/transcription/[id]/download` | Download the resulting note |
| `POST` | `/api/transcription/callback` | Completion callback from the external service (shared-secret authenticated) |

### `/api/obo/rag/[...path]`

On-behalf-of proxy to the RAG service, forwarding `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`.
Exchanges the user's token so retrieval runs with the signed-in user's permissions.

---

## Type System

Domain types are **plain TypeScript**. Runtime validation is applied only at external trust
boundaries — incoming request bodies, the EasyAuth header, and SSE events from vendors. Zod is used
where a schema genuinely earns its keep (discriminated unions, request-body parsing); elsewhere,
hand-written guards are preferred.

**Zod is used in:**

| File | What it validates |
|------|-------------------|
| `src/lib/types/chat.ts` | `ChatConfigSchema` — incoming chat config bodies |
| `src/lib/types/streaming.ts` | `MuginSse` — SSE event discriminated union |
| `src/lib/types/authentication.ts` | `AuthenticatedPrincipalSchema` — currently type inference only |
| `src/lib/types/canvas.ts` | Canvas request body |
| `src/lib/server/transcription/types.ts` | Transcription job payloads |

**Hand-written guards are used in:**

| File | What it parses |
|------|----------------|
| `src/lib/server/auth/get-authenticated-user.ts` | EasyAuth principal claims |
| `src/lib/validation/file-input.ts` | MIME types and data URLs |
| `parseChatRequest()` in `src/routes/api/chat/+server.ts` | `/api/chat` body shape (defined inline, not in `validation/`) |

**Hybrid** — `src/lib/validation/parse-chat-config.ts` runs `ChatConfigSchema.parse()` for shape, then
applies hand-written checks against `APP_CONFIG` (vendor exists, vendor enabled, project known,
model supported):

```typescript
const parsedConfig = parseChatConfig(requestBody.config, APP_CONFIG)
```

> **Caveat:** the `APP_CONFIG` checks throw `HTTPError(400)`, but the Zod stage throws a raw
> `ZodError` and the non-object guard throws a plain `Error`. So a malformed config does **not**
> reliably surface as a controlled 400 — it falls through to the middleware's 500 handler.

Note that `vendorId` values are **uppercase** (`"MISTRAL"`, `"OPENAI"`, `"OLLAMA"`, `"LITELLM"`),
matching the `VENDORS` keys in `APP_CONFIG`.

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

---

## Testing

The project uses Vitest with two separate test projects:

| Test Type | Location | Environment |
|-----------|----------|-------------|
| Client tests | `src/**/*.svelte.{test,spec}.{js,ts}` | Browser |
| Server tests | `tests/server/**/*.{test,spec}.{js,ts}` | Node.js |

> **Note on the client glob:** it matches `*.svelte.spec.ts`, not plain `*.spec.ts`. A file named
> `foo.spec.ts` under `src/` is collected by **neither** project and will silently never run.
> Use `npx vitest list` to confirm what is actually collected.

Coverage is currently thin — `tests/server/api/http-request-middleware.test.ts` is the only
substantive test suite. Environment variables for test runs come from `.env.tests`, which Vite loads
automatically because both projects set `mode: "tests"`.

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

The build uses `@sveltejs/adapter-node` for Node.js deployment.

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
| Framework | SvelteKit 2.57, Svelte 5 |
| Language | TypeScript 5.9 |
| AI Providers | OpenAI, Mistral AI, Ollama, LiteLLM |
| Database | MongoDB |
| Validation | Zod 4.3 (at trust boundaries) |
| Logging | @vestfoldfylke/loglady |
| Linting | Biome |
| Testing | Vitest |
| Markdown | markdown-it, highlight.js, KaTeX |
| Documents | docx |

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by the Mugin Team of Vestfold and Telemark fylkeskommuner.
