# Chat Config Service Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract chatconfig create/update/delete orchestration from SvelteKit route handlers into a dedicated server-side service, keeping routes thin and adding service-level tests.

**Architecture:** Introduce `src/lib/server/services/chat-config-service.ts` that owns parsing, authorization, ownership stamping, and persistence. Both route files (`+server.ts` and `[_id]/+server.ts`) delegate to service functions, reducing their handlers to: parse ID from params → call service → return JSON. No behavior changes.

**Tech Stack:** TypeScript (strict), SvelteKit, Vitest, existing `IChatConfigStore`, `HTTPError`, `authorization.ts`, `parseChatConfig`, `omitChatConfigId`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/server/services/chat-config-service.ts` | All orchestration: parse body, authorize, stamp ownership, call store |
| Modify | `src/routes/api/chatconfigs/+server.ts` | Thin: parse params, call service, return json |
| Modify | `src/routes/api/chatconfigs/[_id]/+server.ts` | Thin: parse params, call service, return json |
| Create | `tests/server/api/chat-config-service.test.ts` | Unit tests for service functions (mock store) |

---

### Task 1: Write failing tests for the service

**Files:**
- Create: `tests/server/api/chat-config-service.test.ts`

The service will export four functions:
- `listChatConfigs(user, store)` → `Promise<ChatConfig[]>`
- `createChatConfig(body, user, appConfig, store)` → `Promise<ChatConfig>`
- `replaceChatConfig(configId, body, user, appConfig, store)` → `Promise<ChatConfig>`
- `deleteChatConfig(configId, user, appConfig, store)` → `Promise<void>`

- [ ] **Step 1.1: Write the failing test file**

```typescript
// tests/server/api/chat-config-service.test.ts
import { describe, expect, it, vi } from "vitest"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AppConfig, AppRoles } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, NewChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import { createChatConfig, deleteChatConfig, listChatConfigs, replaceChatConfig } from "$lib/server/services/chat-config-service"

const appRoles: AppRoles = {
	ADMIN: "Admin",
	AGENT_MAINTAINER: "AgentMaintainer",
	EMPLOYEE: "Employee",
	STUDENT: "Student",
	EDU_EMPLOYEE: "EduEmployee"
}

const appConfig = {
	APP_ROLES: appRoles,
	VENDORS: {
		OPENAI: {
			ENABLED: true,
			PROJECTS: ["DEFAULT"],
			MODELS: [{ ID: "gpt-4.1", SUPPORTED_MESSAGE_FILE_MIME_TYPES: { FILE: [], IMAGE: [] } }],
			NAME: "OpenAI"
		},
		MISTRAL: { ENABLED: false, PROJECTS: [], MODELS: [], NAME: "Mistral" },
		OLLAMA: { ENABLED: false, PROJECTS: [], MODELS: [], NAME: "Ollama" },
		LITELLM: { ENABLED: false, PROJECTS: [], MODELS: [], NAME: "LiteLLM" }
	}
} as AppConfig

const user = (overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal => ({
	userId: "user-1",
	name: "User One",
	preferredUserName: "user@example.com",
	roles: ["Employee"],
	groups: [],
	...overrides
})

const existingConfig = (): ChatConfig => ({
	_id: "507f1f77bcf86cd799439011",
	name: "My Config",
	description: "Desc",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4.1",
	type: "private",
	accessGroups: [],
	created: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1", name: "User One" } },
	updated: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1", name: "User One" } }
})

const validBody = (): unknown => ({
	_id: "507f1f77bcf86cd799439011",
	name: "My Config",
	description: "Desc",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4.1",
	type: "private",
	accessGroups: [],
	created: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1" } },
	updated: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1" } }
})

const makeStore = (overrides: Partial<IChatConfigStore> = {}): IChatConfigStore => ({
	getChatConfig: vi.fn().mockResolvedValue(existingConfig()),
	getChatConfigs: vi.fn().mockResolvedValue([existingConfig()]),
	createChatConfig: vi.fn().mockImplementation(async (cfg: NewChatConfig) => ({ ...cfg, _id: "new-id" }) as ChatConfig),
	replaceChatConfig: vi.fn().mockImplementation(async (_id: string, cfg: NewChatConfig) => ({ ...cfg, _id }) as ChatConfig),
	deleteChatConfig: vi.fn().mockResolvedValue(undefined),
	...overrides
})

describe("listChatConfigs", () => {
	it("delegates to store and returns results", async () => {
		const store = makeStore()
		const result = await listChatConfigs(user(), store)
		expect(store.getChatConfigs).toHaveBeenCalledWith(user())
		expect(result).toHaveLength(1)
	})
})

describe("createChatConfig", () => {
	it("throws 400 when userId is missing", async () => {
		const u = user({ userId: "" })
		await expect(createChatConfig(validBody(), u, appConfig, makeStore())).rejects.toMatchObject({ status: 400 })
	})

	it("throws 400 for invalid body", async () => {
		await expect(createChatConfig({ not: "valid" }, user(), appConfig, makeStore())).rejects.toMatchObject({ status: 400 })
	})

	it("throws 403 when non-maintainer tries to create published config", async () => {
		const body = { ...validBody() as Record<string, unknown>, type: "published" }
		await expect(createChatConfig(body, user({ roles: ["Employee"] }), appConfig, makeStore())).rejects.toMatchObject({ status: 403 })
	})

	it("allows maintainer to create published config", async () => {
		const store = makeStore()
		const body = { ...validBody() as Record<string, unknown>, type: "published" }
		const result = await createChatConfig(body, user({ roles: ["AgentMaintainer"] }), appConfig, store)
		expect(store.createChatConfig).toHaveBeenCalled()
		expect(result._id).toBe("new-id")
	})

	it("stamps created/updated with caller identity and current time", async () => {
		const store = makeStore()
		await createChatConfig(validBody(), user({ userId: "u-42", name: "Alice" }), appConfig, store)
		const call = vi.mocked(store.createChatConfig).mock.calls[0]?.[0]
		expect(call?.created.by.id).toBe("u-42")
		expect(call?.created.by.name).toBe("Alice")
		expect(call?.updated.by.id).toBe("u-42")
	})

	it("calls store.createChatConfig without _id field", async () => {
		const store = makeStore()
		await createChatConfig(validBody(), user(), appConfig, store)
		const call = vi.mocked(store.createChatConfig).mock.calls[0]?.[0]
		expect(call).not.toHaveProperty("_id")
	})
})

describe("replaceChatConfig", () => {
	it("throws 404 when config does not exist", async () => {
		const store = makeStore({ getChatConfig: vi.fn().mockResolvedValue(null) })
		await expect(replaceChatConfig("507f1f77bcf86cd799439011", validBody(), user(), appConfig, store)).rejects.toMatchObject({ status: 404 })
	})

	it("throws 403 when user is not authorized to update", async () => {
		const store = makeStore()
		const nonOwner = user({ userId: "other-user" })
		await expect(replaceChatConfig("507f1f77bcf86cd799439011", validBody(), nonOwner, appConfig, store)).rejects.toMatchObject({ status: 403 })
	})

	it("allows owner to replace their config", async () => {
		const store = makeStore()
		const result = await replaceChatConfig("507f1f77bcf86cd799439011", validBody(), user({ userId: "user-1" }), appConfig, store)
		expect(store.replaceChatConfig).toHaveBeenCalled()
		expect(result._id).toBe("507f1f77bcf86cd799439011")
	})

	it("allows admin to replace any config", async () => {
		const store = makeStore()
		const admin = user({ userId: "admin-1", roles: ["Admin"] })
		const result = await replaceChatConfig("507f1f77bcf86cd799439011", validBody(), admin, appConfig, store)
		expect(result._id).toBe("507f1f77bcf86cd799439011")
	})

	it("throws 400 for invalid body", async () => {
		await expect(replaceChatConfig("507f1f77bcf86cd799439011", { bad: "body" }, user(), appConfig, makeStore())).rejects.toMatchObject({ status: 400 })
	})
})

describe("deleteChatConfig", () => {
	it("throws 404 when config does not exist", async () => {
		const store = makeStore({ getChatConfig: vi.fn().mockResolvedValue(null) })
		await expect(deleteChatConfig("507f1f77bcf86cd799439011", user(), appConfig, store)).rejects.toMatchObject({ status: 404 })
	})

	it("throws 403 when user is not owner or admin", async () => {
		const store = makeStore()
		const nonOwner = user({ userId: "other-user" })
		await expect(deleteChatConfig("507f1f77bcf86cd799439011", nonOwner, appConfig, store)).rejects.toMatchObject({ status: 403 })
	})

	it("allows owner to delete their config", async () => {
		const store = makeStore()
		await expect(deleteChatConfig("507f1f77bcf86cd799439011", user({ userId: "user-1" }), appConfig, store)).resolves.toBeUndefined()
		expect(store.deleteChatConfig).toHaveBeenCalledWith("507f1f77bcf86cd799439011")
	})

	it("allows admin to delete any config", async () => {
		const store = makeStore()
		const admin = user({ roles: ["Admin"] })
		await expect(deleteChatConfig("507f1f77bcf86cd799439011", admin, appConfig, store)).resolves.toBeUndefined()
	})
})
```

- [ ] **Step 1.2: Run tests to verify they fail with "cannot find module"**

```bash
npm run test:unit -- --reporter=verbose tests/server/api/chat-config-service.test.ts
```

Expected: FAIL — `Cannot find module '$lib/server/services/chat-config-service'`

---

### Task 2: Implement the chat config service

**Files:**
- Create: `src/lib/server/services/chat-config-service.ts`

- [ ] **Step 2.1: Create the service file**

```typescript
// src/lib/server/services/chat-config-service.ts
import { canPublishChatConfig, canUpdateChatConfig } from "$lib/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, NewChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import { omitChatConfigId } from "$lib/validation/chat-config"
import { parseChatConfig } from "$lib/validation/parse-chat-config"

export const listChatConfigs = async (user: AuthenticatedPrincipal, store: IChatConfigStore): Promise<ChatConfig[]> => {
	return store.getChatConfigs(user)
}

export const createChatConfig = async (body: unknown, user: AuthenticatedPrincipal, appConfig: AppConfig, store: IChatConfigStore): Promise<ChatConfig> => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	const chatConfig = parseChatConfig(body, appConfig)

	if (chatConfig.type === "published" && !canPublishChatConfig(user, appConfig.APP_ROLES)) {
		throw new HTTPError(403, "User is not authorized to create published chat configs")
	}

	const now = new Date().toISOString()
	const chatConfigToCreate: NewChatConfig = {
		...omitChatConfigId(chatConfig),
		name: chatConfig.name || "Ny agent",
		type: chatConfig.type,
		accessGroups: chatConfig.accessGroups,
		created: {
			at: now,
			by: {
				id: user.userId,
				name: user.name
			}
		},
		updated: {
			at: now,
			by: {
				id: user.userId,
				name: user.name
			}
		}
	}

	return store.createChatConfig(chatConfigToCreate)
}

export const replaceChatConfig = async (configId: string, body: unknown, user: AuthenticatedPrincipal, appConfig: AppConfig, store: IChatConfigStore): Promise<ChatConfig> => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	const chatConfig = parseChatConfig(body, appConfig)

	const existing = await store.getChatConfig(configId)
	if (!existing) {
		throw new HTTPError(404, "Chat config not found")
	}

	if (!canUpdateChatConfig(user, appConfig.APP_ROLES, existing, chatConfig)) {
		throw new HTTPError(403, "Not authorized to update this chat config")
	}

	const chatConfigUpdateData: NewChatConfig = omitChatConfigId(chatConfig)
	return store.replaceChatConfig(configId, chatConfigUpdateData)
}

export const deleteChatConfig = async (configId: string, user: AuthenticatedPrincipal, appConfig: AppConfig, store: IChatConfigStore): Promise<void> => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	const existing = await store.getChatConfig(configId)
	if (!existing) {
		throw new HTTPError(404, "Chat config not found")
	}

	if (!canUpdateChatConfig(user, appConfig.APP_ROLES, existing, existing)) {
		throw new HTTPError(403, "Not authorized to delete this chat config")
	}

	await store.deleteChatConfig(configId)
}
```

- [ ] **Step 2.2: Run the service tests to verify they pass**

```bash
npm run test:unit -- --reporter=verbose tests/server/api/chat-config-service.test.ts
```

Expected: All tests PASS.

---

### Task 3: Slim down the collection route (`/api/chatconfigs/+server.ts`)

**Files:**
- Modify: `src/routes/api/chatconfigs/+server.ts`

The handler functions become one-liners that call the service. The store and APP_CONFIG are still initialized at module scope (no change to their lifecycle).

- [ ] **Step 3.1: Replace the route file content**

Replace `src/routes/api/chatconfigs/+server.ts` with:

```typescript
import { json, type RequestHandler } from "@sveltejs/kit"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { createChatConfig, listChatConfigs } from "$lib/server/services/chat-config-service"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const chatConfigStore = getChatConfigStore()

const getChatConfigs: ApiNextFunction = async ({ user }) => {
	const chatConfigs = await listChatConfigs(user, chatConfigStore)
	return { isAuthorized: true, response: json(chatConfigs) }
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, getChatConfigs)
}

const createChatConfigHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	const body = await requestEvent.request.json()
	const newConfig = await createChatConfig(body, user, APP_CONFIG, chatConfigStore)
	return { isAuthorized: true, response: json(newConfig) }
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, createChatConfigHandler)
}
```

- [ ] **Step 3.2: Run type check and tests**

```bash
npm run check && npm run test:unit
```

Expected: 0 errors, all tests PASS.

---

### Task 4: Slim down the single-item route (`/api/chatconfigs/[_id]/+server.ts`)

**Files:**
- Modify: `src/routes/api/chatconfigs/[_id]/+server.ts`

- [ ] **Step 4.1: Replace the route file content**

Replace `src/routes/api/chatconfigs/[_id]/+server.ts` with:

```typescript
import { json, type RequestHandler } from "@sveltejs/kit"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { deleteChatConfig, replaceChatConfig } from "$lib/server/services/chat-config-service"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const chatConfigStore = getChatConfigStore()

const replaceChatConfigHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	const configId = requestEvent.params._id
	if (!configId) {
		throw new HTTPError(400, "_id parameter is required")
	}
	const body = await requestEvent.request.json()
	const updated = await replaceChatConfig(configId, body, user, APP_CONFIG, chatConfigStore)
	return { isAuthorized: true, response: json(updated) }
}

export const PUT: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, replaceChatConfigHandler)
}

const deleteChatConfigHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	const configId = requestEvent.params._id
	if (!configId) {
		throw new HTTPError(400, "_id parameter is required")
	}
	await deleteChatConfig(configId, user, APP_CONFIG, chatConfigStore)
	return { isAuthorized: true, response: json({ message: "Chat config deleted" }) }
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, deleteChatConfigHandler)
}
```

- [ ] **Step 4.2: Run type check, lint, and full test suite**

```bash
npm run check && npm run lint && npm run test
```

Expected: 0 type errors, 0 lint errors, all tests PASS.

---

### Task 5: Update REFACTOR_PLAN.md

**Files:**
- Modify: `REFACTOR_PLAN.md`

- [ ] **Step 5.1: Add a dated progress entry**

Append to the Progress log section in `REFACTOR_PLAN.md`:

```markdown
### 2026-05-21 — Chat config service extraction

Completed:

- Created `src/lib/server/services/chat-config-service.ts` with `listChatConfigs`, `createChatConfig`, `replaceChatConfig`, and `deleteChatConfig`.
- Moved parsing, authorization, ownership stamping, and persistence orchestration out of route handlers into the service.
- Slimmed `src/routes/api/chatconfigs/+server.ts` and `src/routes/api/chatconfigs/[_id]/+server.ts` to thin param-extraction + service-call + json-response handlers.
- Added `tests/server/api/chat-config-service.test.ts` with unit tests for all four service operations, covering 400/403/404 error paths and happy paths.
- No behavior changes to existing API contracts.

Verified:

- `npm run check` reports 0 errors and 0 warnings.
- `npm run lint` reports 0 issues.
- `npm run test` passes.
```

---

## Self-Review

**Spec coverage:**
- ✅ Move orchestration out of routes → service owns it
- ✅ Centralize validation, authorization, ownership stamping, persistence → all in service
- ✅ Keep routes thin → routes only parse params + call service + return json
- ✅ Preserve response shapes → same json payloads returned
- ✅ Add tests for service logic → Task 1 covers all four operations with error paths
- ✅ No broad rewrites → routes become shorter; service mirrors old logic exactly
- ✅ HTTPError throughout → service throws HTTPError on all failure paths
- ✅ Run check/lint/test → explicit steps 3.2, 4.2

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `IChatConfigStore` used consistently from `$lib/types/db/db-interface`
- `parseChatConfig` signature `(body: unknown, appConfig: AppConfig)` matches existing function
- `omitChatConfigId` signature `(chatConfig: ChatConfig): NewChatConfig` matches existing function
- `canPublishChatConfig(user, appRoles)` and `canUpdateChatConfig(user, appRoles, existing, input)` match existing authorization.ts signatures
- `listChatConfigs`, `createChatConfig`, `replaceChatConfig`, `deleteChatConfig` named consistently in tests and service
