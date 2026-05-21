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
- **Modern UI** - Svelte 5 Runes for reactive state management with markdown and LaTeX rendering

---

## Table of Contents

- [Architecture](#architecture)
  - [System Overview](#system-overview)
  - [Vendor Abstraction](#vendor-abstraction)
  - [Authentication Flow](#authentication-flow)
  - [Streaming Architecture](#streaming-architecture)
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
3. Middleware extracts and validates claims using plain type guards in `src/lib/validation/auth-principal.ts`
4. `AuthenticatedPrincipal` object created with userId, name, roles, and groups

**Development (Mock Authentication):**
- Enabled via `MOCK_AUTH="true"` environment variable
- Roles and groups configurable via environment variables

### Streaming Architecture

Real-time AI responses use Server-Sent Events with the following event types:

| Event | Description |
|-------|-------------|
| `response.config` | Chat configuration metadata nobody uses? |
| `response.started` | Response initiated with responseId |
| `response.output_text.delta` | Incremental text chunk |
| `response.done` | Completion with token usage statistics |
| `response.error` | Error information |
| `conversation.created` | New conversation identifier |

All events are validated using Zod discriminated unions for type-safe handling.

---

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

---

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

---

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

**Principle:** TypeScript is sufficient for internal code once inputs are validated. Zod is used only where a structured schema adds real value. See `docs/adr/0001-validation-strategy.md`.

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
