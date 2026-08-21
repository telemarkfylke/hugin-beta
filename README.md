# Hugin Beta

A multi-provider AI chat application built with SvelteKit, providing a unified interface to multiple AI providers with enterprise-grade authentication and real-time streaming responses.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.22-orange.svg)](https://kit.svelte.dev/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5.0-red.svg)](https://svelte.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Hugin Beta is an internal AI-agent web application designed to provide a democratic, secure, flexible, and user-friendly AI solution. The application supports multiple AI providers through a vendor-agnostic architecture, ensuring built-in privacy and seamless user experience.

### Key Features

- **Multi-Provider Support** - Unified interface for OpenAI and Mistral AI (Ollama support in development)
- **Real-Time Streaming** - Server-Sent Events (SSE) for incremental AI responses
- **Enterprise Authentication** - Microsoft Entra ID integration with role-based access control
- **Multi-Modal Input** - Support for text, images, and document uploads
- **Canvas** - AI-assisted document editor with web search, manual editing, and export to text and Word
- **Modern UI** - Svelte 5 Runes for reactive state management with markdown and LaTeX rendering

---

## Table of Contents

- [Architecture](#architecture)
  - [System Overview](#system-overview)
  - [Vendor Abstraction](#vendor-abstraction)
  - [Authentication Flow](#authentication-flow)
  - [Streaming Architecture](#streaming-architecture)
- [Features](#features)
  - [Canvas](#canvas)
  - [Feature Spotlight](#feature-spotlight)
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
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   OpenAI    │  │  Mistral AI │  │   Ollama    │             │
│  │   Vendor    │  │   Vendor    │  │   Vendor    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
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
3. Middleware extracts and validates claims with Zod
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

All events are validated using Zod discriminated unions for type-safe handling.

---

### Authorization
- Uses the functions in authorization.ts
- Regular users can define their own chatConfigs and test basically any config against the api/chat endpoint
  - But they cannot define chatconfigs with predefined agent/prompt-ids where the config is set up in a vendor.
  - They can use predefined chatconfigs only if they have access to the agentId in some defined chatconfig in db - which is created by a user with more permissions.

---

## Features

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
- Hardcoded to OpenAI `gpt-5.6-terra` — no model selection needed

**Access control:**

Canvas is gated behind the `CANVAS_ENABLED` environment variable and requires the `EMPLOYEE` or `ADMIN` role. Both the page load and the API endpoint enforce this independently.

**Relevant files:**

| File | Purpose |
|------|---------|
| `src/routes/canvas/+page.svelte` | Canvas UI — editor, prompt bar, export |
| `src/routes/canvas/+page.server.ts` | Page load with auth/feature-flag check |
| `src/routes/api/canvas/+server.ts` | POST endpoint — streams AI response |
| `src/lib/types/canvas.ts` | Canvas request type (plain TypeScript) |

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

## Getting Started

### Prerequisites

- **Node.js** - Latest LTS version (v20+)
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

# Mock Database Configuration
MOCK_DB="true"                    # Use in-memory database (required for local dev)
# Or production Database Configuration
MONGODB_CONNECTION_STRING="mongodb+srv://..." # Production MongoDB connection
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

# Feature flags
CANVAS_ENABLED="true"             # Enable the Canvas document editor
```

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
│   ├── types/                    # Zod schemas and TypeScript types
│   │   ├── AIVendor.ts          # Core vendor interface
│   │   ├── chat.ts              # Chat request/response types
│   │   ├── chat-item.ts         # Message types
│   │   ├── chat-item-content.ts # Content types (text, file, image)
│   │   ├── streaming.ts         # SSE event types
│   │   ├── canvas.ts            # Canvas request type
│   │   └── authentication.ts    # Auth types
│   ├── server/                   # Server-only code
│   │   ├── ai-vendors.ts        # Vendor factory
│   │   ├── openai/              # OpenAI implementation
│   │   ├── mistral/             # Mistral implementation
│   │   ├── auth/                # Authentication handlers
│   │   ├── middleware/          # HTTP middleware
│   │   └── db/                  # Database abstraction
│   ├── components/              # Svelte components
│   │   └── Chat/                # Chat UI components
│   └── streaming.ts             # SSE utilities
├── routes/                       # SvelteKit routes
│   ├── +layout.server.ts        # Root auth middleware
│   ├── +page.svelte             # Home page
│   ├── api/
│   │   ├── chat/+server.ts      # Chat streaming endpoint
│   │   ├── canvas/+server.ts    # Canvas streaming endpoint
│   │   └── chatconfigs/         # Config CRUD endpoints
│   ├── canvas/                  # Canvas document editor
│   └── agents/                  # Agent management pages
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
    vendorId: "openai" | "mistral",
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

### POST `/api/chatconfigs`

Create a new chat configuration.

### PATCH `/api/chatconfigs/[_id]`

Update an existing chat configuration.

---

## Type System

The application uses a **Zod-first** approach where all types are defined as Zod schemas, then TypeScript types are inferred:

```typescript
// Schema definition
const ChatConfigSchema = z.object({
  _id: z.string(),
  name: z.string(),
  vendorId: z.enum(["openai", "mistral", "ollama"]),
  model: z.string().optional(),
  // ...
})

// Type inference
type ChatConfig = z.infer<typeof ChatConfigSchema>

// Runtime validation
const result = ChatConfigSchema.safeParse(data)
```

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

The build uses `@sveltejs/adapter-node` for Node.js deployment.

### Production Environment Variables

```bash
# Required
MONGO_DB_URI="mongodb+srv://..."
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
| Framework | SvelteKit 2.22, Svelte 5 |
| Language | TypeScript 5.9 |
| AI Providers | OpenAI, Mistral AI |
| Database | MongoDB |
| Validation | Zod 4.1 |
| Linting | Biome |
| Testing | Vitest |
| Markdown | markdown-it, highlight.js, KaTeX |

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by the Mugin Team of Vestfold and Telemark fylkeskommuner.
