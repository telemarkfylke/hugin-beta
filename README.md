# Hugin Beta

An internal AI chat application built with SvelteKit 5, providing a multi-modal interface to OpenAI and Mistral AI via the Vercel AI SDK v6.

## Overview

Hugin Beta is an enterprise AI chat application designed for use in Norwegian county municipalities. It provides a secure, role-governed interface to large language models, with Microsoft Entra ID authentication, per-project API key isolation, optional web search, and support for file and image attachments.

The application is a SvelteKit monolith. The server side handles authentication, authorization, and AI provider integration. The client side is built with Svelte 5 Runes and uses the Vercel AI SDK's `@ai-sdk/svelte` package for reactive chat state.

### Key Capabilities

- Real-time streaming AI responses via the Vercel AI SDK
- OpenAI (`gpt-5.5`) and Mistral (`mistral-large-latest`) support
- Optional web search tool (OpenAI only, via `openai.tools.webSearch()`)
- Multi-modal input: text, images, and document file attachments
- Per-project API key isolation — different keys per deployment context
- Role-based and group-based access control (Entra ID)
- Chat configuration management (create, publish, share assistants)
- Transcription service integration (audio-to-note via internal service)
- Markdown and LaTeX rendering in chat responses

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | SvelteKit 2, Svelte 5 (Runes) |
| Language | TypeScript 5.9 (strict mode) |
| AI Integration | Vercel AI SDK v6 (`ai`, `@ai-sdk/openai`, `@ai-sdk/mistral`, `@ai-sdk/svelte`) |
| Validation | Zod 4 (API boundaries only) |
| Linting / Formatting | Biome |
| Testing | Vitest |
| Authentication | Microsoft Entra ID via Azure App Service EasyAuth |
| Database | MongoDB (driver installed; in-memory mock for development) |
| Deployment | `@sveltejs/adapter-node` |
| Logging | `@vestfoldfylke/loglady` with optional BetterStack forwarding |

---

## Architecture

### AI Integration

The application uses the **Vercel AI SDK v6 directly** — there is no custom vendor abstraction layer. Two providers are supported:

| Provider | Vendor ID | Model |
|---|---|---|
| OpenAI | `OPENAI` | `gpt-5.5` |
| Mistral | `MISTRAL` | `mistral-large-latest` |

On the server, `resolveModel()` in `src/lib/server/ai-sdk/resolve-model.ts` creates a provider instance from the appropriate API key and returns an AI SDK `LanguageModel`. The chat endpoint calls `streamText()` and returns `result.toUIMessageStreamResponse()`.

On the client, `ChatState` (in `src/lib/components/Chat/ChatState.svelte.ts`) instantiates an AI SDK `Chat` object from `@ai-sdk/svelte`, configured with a `DefaultChatTransport` pointing at `/api/chat`. The `Chat` object owns the message list and streaming state; `ChatState` wraps it with Svelte 5 `$state` for reactivity and adds file upload, config persistence, and web search toggle logic.

### Per-Project API Keys

API keys are namespaced by vendor and project name:

```
OPENAI_API_KEY_PROJECT_DEFAULT
OPENAI_API_KEY_PROJECT_MYPROJECT
MISTRAL_API_KEY_PROJECT_DEFAULT
```

The `project` field on a `ChatConfig` determines which key is used at request time. This allows different assistants to bill to different accounts without any code changes.

### Web Search

Web search is supported on OpenAI configs via `openai.tools.webSearch()`. It is opt-in per chat session (a toggle in the UI). When enabled, the tool is injected into the `streamText()` call. The `resolveTools()` function in `src/lib/server/ai-sdk/resolve-tools.ts` handles tool assembly.

### Authentication

**Production:** Azure App Service EasyAuth validates the user's Entra ID token before the request reaches the application. The validated claims arrive as a base64-encoded JSON payload in the `X-MS-CLIENT-PRINCIPAL` header. The middleware in `src/lib/server/auth/get-authenticated-user.ts` decodes and parses these claims into an `AuthenticatedPrincipal` with `userId`, `name`, `roles`, and `groups`.

**Development:** Set `MOCK_AUTH="true"` to bypass EasyAuth. Use `MOCK_AUTH_ROLES` and `MOCK_AUTH_GROUPS` to configure the mock user's roles and group memberships.

Authentication runs on every request via `+layout.server.ts`, which calls `getAuthenticatedPrincipal()` and injects the result into `event.locals`.

### Authorization

Authorization is enforced at two levels:

1. **Middleware level** — `apiRequestMiddleware()` authenticates the user before any handler runs.
2. **Handler level** — handlers call functions from `src/lib/authorization.ts` to check resource-level permissions.

The main authorization functions:

| Function | Purpose |
|---|---|
| `canPromptConfig` | Can this user send a message using this config? |
| `canEditChatConfig` | Can this user edit this config? |
| `canPublishChatConfig` | Can this user publish a config (make it visible to others)? |
| `canViewAllChatConfigs` | Can this user see all configs in the system? |
| `canUpdateChatConfig` | Can this user save changes to an existing config? |

Access to a published config is determined by the config's `accessGroups` field, which can be role-based (`"all"`, `"employee"`, `"student"`, `"edu_employee"`) or Entra ID group-based (object IDs).

### Validation

Zod is used **only at external trust boundaries**:

- `src/lib/validation/parse-chat-config.ts` — validates the `config` object on every `/api/chat` request
- `src/lib/types/chat.ts` — `ChatConfigSchema` defines the Zod schema, from which the `ChatConfig` TypeScript type is derived

Plain TypeScript type guards are used everywhere else (auth claim parsing, environment variable validation).

### Error Handling

All server errors are thrown as `HTTPError(status, message)` from `src/lib/server/middleware/http-error.ts`. The middleware catches these and serializes them as JSON responses. Internal details are never exposed to the client.

### Logging

All server-side code uses `logger` from `@vestfoldfylke/loglady`. Use `{placeholder}` syntax for structured fields:

```typescript
logger.info("Chat request for config {configId} by {userId}", config._id, user.userId)
logger.errorException(error, "Failed to call provider")
```

BetterStack log forwarding activates automatically when `BETTERSTACK_URL` and `BETTERSTACK_TOKEN` environment variables are set.

---

## Getting Started

### Prerequisites

- Node.js v20 or later
- npm (included with Node.js)
- At least one API key: OpenAI or Mistral

### Installation

```bash
git clone <repository-url>
cd hugin-beta
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Minimum configuration for local development:

```bash
OPENAI_API_KEY_PROJECT_DEFAULT="sk-..."   # or a Mistral key below
MISTRAL_API_KEY_PROJECT_DEFAULT="..."
MOCK_DB="true"
MOCK_AUTH="true"
MOCK_AUTH_ROLES="Employee,Admin"
APP_ROLE_EMPLOYEE="Employee"
APP_ROLE_STUDENT="Student"
APP_ROLE_ADMIN="Admin"
APP_ROLE_AGENT_MAINTAINER="AgentMaintainer"
```

### Start the Development Server

```bash
npm run dev
```

The application is available at `http://localhost:5173`.

---

## Environment Variables

### Application

| Variable | Description | Default |
|---|---|---|
| `APP_NAME` | Application display name | `Mugin` |
| `DEFAULT_AGENT_ID` | ID of the agent loaded on the home page | — |
| `BODY_SIZE_LIMIT` | Max HTTP body size in bytes (or `NNM` for megabytes) | `10485760` (10 MB) |
| `NEW_CHAT_CONFIRM_DISABLED` | Set `true` to suppress new-chat confirmation dialog | `false` |

### Authentication

| Variable | Description |
|---|---|
| `MOCK_AUTH` | Set `true` to enable mock authentication (local development only) |
| `MOCK_AUTH_ROLES` | Comma-separated list of role values for the mock user (e.g. `Employee,Admin`) |
| `MOCK_AUTH_GROUPS` | Comma-separated Entra ID group object IDs for the mock user |

### Application Roles

These values must match the role claim values configured in Entra ID.

| Variable | Description |
|---|---|
| `APP_ROLE_EMPLOYEE` | Role value for employees |
| `APP_ROLE_STUDENT` | Role value for students |
| `APP_ROLE_ADMIN` | Role value for administrators |
| `APP_ROLE_AGENT_MAINTAINER` | Role value for users who can publish and manage assistants |

### AI Providers

API keys follow the naming convention `{VENDOR}_API_KEY_PROJECT_{PROJECT}`. The project name `DEFAULT` is always required; additional project names can be added freely.

| Variable | Description |
|---|---|
| `OPENAI_API_KEY_PROJECT_DEFAULT` | OpenAI API key for the default project |
| `MISTRAL_API_KEY_PROJECT_DEFAULT` | Mistral API key for the default project |

To add a project named `SCHOOL`, add `OPENAI_API_KEY_PROJECT_SCHOOL` and reference it in `ChatConfig.project = "SCHOOL"`.

### Database

| Variable | Description |
|---|---|
| `MOCK_DB` | Set `true` to use an in-memory store (required for local development) |
| `MONGODB_CONNECTION_STRING` | MongoDB Atlas connection string (production) |
| `MONGODB_DB_NAME` | Database name (production) |

### Transcription Service (optional)

| Variable | Description |
|---|---|
| `TALE_TIL_NOTAT_URL` | Internal URL of the transcription service |
| `TRANSCRIPTION_CALLBACK_SECRET` | Shared secret for authenticating transcription callbacks |
| `TRANSCRIPTION_GROUP_N_ID` | Entra ID group object ID for transcription use case N |
| `TRANSCRIPTION_GROUP_N_LABEL` | Display label for transcription use case N |
| `COPYPARTY_BASE_URL` | Internal Copyparty file store base URL |

### Logging (optional)

| Variable | Description |
|---|---|
| `BETTERSTACK_URL` | BetterStack ingestion endpoint |
| `BETTERSTACK_TOKEN` | BetterStack source token |

---

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start development server at `http://localhost:5173` |
| `npm run dev -- --open` | Start dev server and open browser |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run test` | Full test suite: `tsc` + Biome + build + Vitest |
| `npm run test:unit` | Run Vitest unit tests only |
| `npm run test:unit -- --watch` | Run tests in watch mode |
| `npm run check` | TypeScript + Svelte type checking |
| `npm run check:watch` | Type checking in watch mode |
| `npm run lint` | Run Biome linter (check only) |
| `npm run lint:fix` | Auto-fix linting issues |

Always run `npm run test` before committing. This pipeline runs type checking, linting, a production build, and the full unit test suite in sequence.

---

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   └── Chat/                   # Chat UI: Chat.svelte, ChatState.svelte.ts,
│   │                               #   ChatInput, ChatHeaderWithConfig, etc.
│   ├── server/
│   │   ├── ai-sdk/                 # AI SDK integration
│   │   │   ├── resolve-model.ts    # Maps ChatConfig.vendorId → LanguageModel
│   │   │   └── resolve-tools.ts    # Assembles AI SDK tools (e.g. web search)
│   │   ├── app-config/             # AppConfig singleton built from env vars
│   │   ├── auth/                   # EasyAuth claim parsing, mock auth
│   │   ├── db/                     # MongoDB abstraction + in-memory mock
│   │   ├── middleware/             # HTTP middleware, HTTPError class
│   │   └── transcription/          # Transcription job management
│   ├── types/
│   │   ├── app-config.ts           # AppConfig, VendorInfo, AppRoles types
│   │   ├── authentication.ts       # AuthenticatedPrincipal, Entra ID claim types
│   │   └── chat.ts                 # ChatConfig, Chat, VendorId, ChatTool,
│   │                               #   ChatConfigSchema (Zod)
│   ├── validation/
│   │   ├── parse-chat-config.ts    # Validates + parses ChatConfig at API boundary
│   │   └── env.ts                  # Environment variable validation at startup
│   └── authorization.ts            # Pure authorization functions (no side effects)
├── routes/
│   ├── +layout.server.ts           # Injects authenticated user on every request
│   ├── +page.svelte                # Home page
│   ├── api/
│   │   ├── chat/+server.ts         # POST /api/chat — streaming AI response
│   │   ├── chatconfigs/            # CRUD endpoints for chat configurations
│   │   └── transcription/          # Transcription job endpoints
│   ├── agents/                     # Agent listing and detail pages
│   ├── admin/                      # Admin pages
│   └── transcription/              # Transcription UI pages
└── app.d.ts                        # SvelteKit locals type (AuthenticatedPrincipal)

tests/
└── server/                         # Server-side Vitest tests (Node environment)
```

---

## Key Concepts

### Adding a New AI Provider

The AI SDK has a large ecosystem of community providers. To add one:

1. Install the provider package, e.g. `npm install @ai-sdk/anthropic`.
2. Add the vendor ID to `AppConfig.VENDORS` in `src/lib/types/app-config.ts`.
3. Add the vendor block (with enabled flag, projects, and supported MIME types) in `src/lib/server/app-config/app-config.ts`.
4. Add a case to `resolveModel()` in `src/lib/server/ai-sdk/resolve-model.ts`.
5. Update `ChatConfigSchema` in `src/lib/types/chat.ts` to include the new vendor ID in the `vendorId` enum.
6. Add the API key variable to `.env.example`.

### Configuring Per-Project API Keys

Each vendor can have multiple named projects. For example, to add an OpenAI project named `SCHOOL`:

1. Add `OPENAI_API_KEY_PROJECT_SCHOOL="sk-..."` to `.env` (and `.env.example`).
2. Create or update a `ChatConfig` with `project: "SCHOOL"` and `vendorId: "OPENAI"`.

`AppConfig.VENDORS.OPENAI.PROJECTS` is populated automatically at startup by scanning environment variable names.

### Adding New Roles or Access Groups

**New role:**

1. Add the role name to Entra ID app registration manifest.
2. Add a corresponding env var (e.g. `APP_ROLE_REVIEWER="Reviewer"`).
3. Add the field to `AppRoles` in `src/lib/types/app-config.ts`.
4. Read it in `app-config.ts` under `APP_ROLES`.
5. Use it in authorization functions in `src/lib/authorization.ts`.

**New Entra group access:**

No code change required. Add an `EntraAccessGroup` entry (`{ id: "<object-id>", displayName: "..." }`) to a `ChatConfig`'s `accessGroups` array. Users who are members of that group will pass the `canPromptConfig` check.

---

## Authentication

### Production (EasyAuth)

Azure App Service EasyAuth intercepts all requests, validates the Entra ID token, and forwards a base64-encoded JSON claims object in the `X-MS-CLIENT-PRINCIPAL` header. The application never handles raw JWTs directly.

`src/lib/server/auth/get-authenticated-user.ts` decodes the header, parses the claims using plain TypeScript type guards (in `src/lib/validation/auth-principal.ts`), and returns an `AuthenticatedPrincipal`:

```typescript
type AuthenticatedPrincipal = {
  userId: string
  name: string
  roles: string[]
  groups: string[]
}
```

If the header is missing or malformed, the request is rejected with HTTP 401.

### Development (Mock Auth)

Set `MOCK_AUTH="true"` in `.env`. The mock user is constructed from:

- `MOCK_AUTH_ROLES` — comma-separated list of role values
- `MOCK_AUTH_GROUPS` — comma-separated Entra group object IDs (leave empty for no groups)

**Note:** `MOCK_AUTH="true"` is rejected at startup in production builds unless `BUILD_PLACEHOLDER_CONFIG=true` is also set.

---

## Testing

The project uses Vitest with two separate test environments:

| Test type | Location | Environment |
|---|---|---|
| Server tests | `tests/server/**/*.test.ts` | Node.js |
| Client tests | `src/**/*.svelte.spec.ts` | Browser (jsdom) |

```bash
# Run all tests (full suite including type check, lint, build)
npm run test

# Run unit tests only
npm run test:unit

# Run in watch mode during development
npm run test:unit -- --watch
```

TypeScript is configured with `strict: true`, `noUncheckedIndexedAccess: true`, and `exactOptionalPropertyTypes: true`. All of these checks must pass as part of `npm run test`.

---

## Deployment

The application uses `@sveltejs/adapter-node` and is deployed as a Node.js process.

```bash
npm run build
node build/index.js
```

### Azure App Service

1. Configure the App Service with the Node.js runtime.
2. Enable EasyAuth (Authentication) with Microsoft Entra ID as the identity provider.
3. Set all required environment variables in Application Settings (or Key Vault references).
4. Deploy the `build/` output using Azure CLI, GitHub Actions, or zip deploy.

Do not set `MOCK_AUTH="true"` in production. All authentication flows through EasyAuth.

---

Built by the Mugin Team at Vestfold og Telemark fylkeskommune.
