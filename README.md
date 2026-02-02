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
MONGODB_CHAT_CONFIG_COLLECTION="chat-configs" # Name of collection which holds chat configurations

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
├── lib/                          # Shared library code
│   ├── types/                    # Zod schemas and TypeScript types
│   │   ├── AIVendor.ts          # Core vendor interface
│   │   ├── chat.ts              # Chat request/response types
│   │   ├── chat-item.ts         # Message types
│   │   ├── chat-item-content.ts # Content types (text, file, image)
│   │   ├── streaming.ts         # SSE event types
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
│   │   └── chatconfigs/         # Config CRUD endpoints
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
