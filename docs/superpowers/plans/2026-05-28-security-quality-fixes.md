# Security & Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 confirmed bugs and security issues found during branch code review.

**Architecture:** Fixes are grouped by file locality — authorization logic, service layer, middleware, DB layer, and SSE client. Each task is independently testable. No new abstractions are added; every fix uses existing patterns.

**Tech Stack:** SvelteKit, TypeScript, Vitest, MongoDB driver, Zod. Tests live in `tests/server/` (Node env) and `src/**/*.svelte.spec.ts` (browser env). Run `npm run test:unit` to run unit tests, `npm run test` for full suite.

---

## File Map

| File | Changes |
|---|---|
| `src/lib/authorization.ts` | Fix duplicate 'student' push; add `canDeleteChatConfig`; refactor `canPromptConfig` to use `getUserRoleAccessGroups` |
| `src/lib/server/services/chat-config-service.ts` | Reconcile URL _id vs body _id; use `canDeleteChatConfig` |
| `src/routes/api/chat/+server.ts` | Fetch config from DB before auth check to prevent `shared` bypass |
| `src/lib/server/middleware/external-error.ts` | Strip `providerMessage`/`providerBody` from client-facing error data |
| `src/lib/components/Chat/PostChatMessage.svelte.ts` | Wrap `flush()` in try/catch; graceful stream-end handling |
| `src/lib/server/db/mongo-db.ts` | Check `modifiedCount` after `replaceOne` |
| `src/routes/api/chatconfigs/+server.ts` | Add `try/catch` around `request.json()` in POST handler |
| `tests/server/authorization.test.ts` | Tests for `canDeleteChatConfig`, deduplicated `getUserRoleAccessGroups`, refactored `canPromptConfig` |
| `tests/server/api/chat-config-service.test.ts` | Tests for ID mismatch → HTTPError(400), delete authorization |
| `tests/server/api/external-error.test.ts` | Test that `providerMessage`/`providerBody` are absent from HTTPError data |

---

## Task 1 — Fix `getUserRoleAccessGroups` duplicate and `canPromptConfig` refactor

**Fixes:** #8 (student pushed twice), #9 (canPromptConfig duplicates role logic)

**Files:**
- Modify: `src/lib/authorization.ts`
- Modify: `tests/server/authorization.test.ts`

- [ ] **Step 1.1: Write failing tests**

In `tests/server/authorization.test.ts`, add inside the existing `describe("authorization rules", ...)` block:

```typescript
describe("getUserRoleAccessGroups", () => {
  it("returns only 'all' for a user with no special roles", () => {
    const u = user({ roles: [] })
    expect(getUserRoleAccessGroups(u, appRoles)).toEqual(["all"])
  })

  it("includes 'employee' for Employee role", () => {
    const u = user({ roles: ["Employee"] })
    expect(getUserRoleAccessGroups(u, appRoles)).toEqual(["all", "employee"])
  })

  it("includes 'edu_employee' and 'student' for EduEmployee role", () => {
    const u = user({ roles: ["EduEmployee"] })
    expect(getUserRoleAccessGroups(u, appRoles)).toEqual(["all", "edu_employee", "student"])
  })

  it("does NOT include 'student' twice when user has both EduEmployee and Student roles", () => {
    const u = user({ roles: ["EduEmployee", "Student"] })
    const groups = getUserRoleAccessGroups(u, appRoles)
    const studentCount = groups.filter((g) => g === "student").length
    expect(studentCount).toBe(1)
    expect(groups).toEqual(["all", "edu_employee", "student"])
  })

  it("includes 'student' for Student role only", () => {
    const u = user({ roles: ["Student"] })
    expect(getUserRoleAccessGroups(u, appRoles)).toEqual(["all", "student"])
  })
})
```

Also add the import at the top: `import { canDeleteChatConfig, canEditPredefinedConfig, canPromptConfig, canPublishChatConfig, canUpdateChatConfig, canViewAllChatConfigs, getUserRoleAccessGroups } from "$lib/authorization"`

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd /Users/fuzzbin/Documents/GitHub_TFK/hugin-beta && npm run test:unit -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|getUserRoleAccessGroups"
```

Expected: tests fail because `canDeleteChatConfig` is not exported and `getUserRoleAccessGroups` has the duplicate bug.

- [ ] **Step 1.3: Fix `getUserRoleAccessGroups` and add `canDeleteChatConfig`**

Replace the body of `getUserRoleAccessGroups` and add the new function in `src/lib/authorization.ts`:

```typescript
export const getUserRoleAccessGroups = (user: AuthenticatedPrincipal, appRoles: AppRoles): RoleAccessGroups[] => {
	const groups: RoleAccessGroups[] = ["all"]
	if (user.roles.includes(appRoles.EMPLOYEE)) groups.push("employee")
	if (user.roles.includes(appRoles.EDU_EMPLOYEE)) {
		groups.push("edu_employee")
		if (!groups.includes("student")) groups.push("student")
	}
	if (user.roles.includes(appRoles.STUDENT) && !groups.includes("student")) groups.push("student")
	return groups
}
```

Also refactor `canPromptConfig` to use `getUserRoleAccessGroups` instead of the inline cascade. Replace the `if (chatConfig.type === "published")` block:

```typescript
export const canPromptConfig = (user: AuthenticatedPrincipal, appConfig: AppConfig, chatConfig: ChatConfig): boolean => {
	if (user.roles.includes(appConfig.APP_ROLES.ADMIN)) {
		return true
	}
	if (chatConfig.shared) {
		return true
	}
	if (chatConfig.type === "private" && chatConfig.created.by.id === user.userId) {
		return true
	}
	if (chatConfig.type === "published") {
		if (user.roles.includes(appConfig.APP_ROLES.AGENT_MAINTAINER)) {
			return true
		}
		const userGroups = getUserRoleAccessGroups(user, appConfig.APP_ROLES)
		if (chatConfig.accessGroups.some((group) => typeof group === "string" && userGroups.includes(group as RoleAccessGroups))) {
			return true
		}
		if (chatConfig.accessGroups.some((group) => typeof group !== "string" && user.groups.includes(group.id))) {
			return true
		}
	}
	return false
}
```

Add the new `canDeleteChatConfig` function after `canUpdateChatConfig`:

```typescript
export const canDeleteChatConfig = (user: AuthenticatedPrincipal, appRoles: AppRoles, chatConfig: ChatConfig): boolean => {
	if (user.roles.includes(appRoles.ADMIN)) {
		return true
	}
	if (chatConfig.created.by.id === user.userId) {
		return true
	}
	return false
}
```

- [ ] **Step 1.4: Run tests**

```bash
cd /Users/fuzzbin/Documents/GitHub_TFK/hugin-beta && npm run test:unit -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|getUserRoleAccessGroups|canDelete"
```

Expected: all new tests PASS.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/authorization.ts tests/server/authorization.test.ts
git commit -m "fix: deduplicate student role in getUserRoleAccessGroups; add canDeleteChatConfig; refactor canPromptConfig"
```

---

## Task 2 — Fix service-layer ID mismatch and use `canDeleteChatConfig`

**Fixes:** #4 (ID mismatch → 500 instead of 400), #2 (AgentMaintainer can delete any published config)

**Files:**
- Modify: `src/lib/server/services/chat-config-service.ts`
- Modify: `tests/server/api/chat-config-service.test.ts`

- [ ] **Step 2.1: Write failing tests**

Add to `tests/server/api/chat-config-service.test.ts` inside the existing `describe` blocks:

```typescript
describe("replaceChatConfig", () => {
  // ... (add after existing tests)

  it("throws HTTPError(400) when body _id does not match URL configId", async () => {
    const store = makeStore()
    const bodyWithWrongId = { ...validBody(), _id: "507f1f77bcf86cd799439099" } // different from existingConfig()._id
    await expect(replaceChatConfig("507f1f77bcf86cd799439011", bodyWithWrongId, user(), appConfig, store)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("ID")
    })
  })
})

describe("deleteChatConfig", () => {
  // ... (add after existing tests)

  it("allows the config owner to delete", async () => {
    const store = makeStore()
    await expect(deleteChatConfig("507f1f77bcf86cd799439011", user({ userId: "user-1" }), appConfig, store)).resolves.toBeUndefined()
  })

  it("allows admins to delete any config", async () => {
    const store = makeStore()
    await expect(deleteChatConfig("507f1f77bcf86cd799439011", user({ roles: ["Admin"] }), appConfig, store)).resolves.toBeUndefined()
  })

  it("blocks AgentMaintainer from deleting a published config they do not own", async () => {
    const publishedConfig = (): ChatConfig => ({ ...existingConfig(), type: "published", created: { at: "2026-01-01T00:00:00.000Z", by: { id: "other-user", name: "Other" } } })
    const store = makeStore({ getChatConfig: vi.fn().mockResolvedValue(publishedConfig()) })
    await expect(
      deleteChatConfig("507f1f77bcf86cd799439011", user({ roles: ["AgentMaintainer"], userId: "user-1" }), appConfig, store)
    ).rejects.toMatchObject({ status: 403 })
  })

  it("allows AgentMaintainer to delete their own published config", async () => {
    const ownPublishedConfig = (): ChatConfig => ({ ...existingConfig(), type: "published", created: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1", name: "User One" } } })
    const store = makeStore({ getChatConfig: vi.fn().mockResolvedValue(ownPublishedConfig()) })
    await expect(
      deleteChatConfig("507f1f77bcf86cd799439011", user({ roles: ["AgentMaintainer"], userId: "user-1" }), appConfig, store)
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
cd /Users/fuzzbin/Documents/GitHub_TFK/hugin-beta && npm run test:unit -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|replaceChatConfig|deleteChatConfig"
```

Expected: new tests fail.

- [ ] **Step 2.3: Fix `replaceChatConfig` and `deleteChatConfig`**

In `src/lib/server/services/chat-config-service.ts`:

1. Add import for `canDeleteChatConfig`:
```typescript
import { canDeleteChatConfig, canPublishChatConfig, canUpdateChatConfig } from "$lib/authorization"
```

2. In `replaceChatConfig`, add an ID reconciliation check after `parseChatConfig` and before `getChatConfig`:
```typescript
export const replaceChatConfig = async (configId: string, body: unknown, user: AuthenticatedPrincipal, appConfig: AppConfig, store: IChatConfigStore): Promise<ChatConfig> => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	const chatConfig = parseChatConfig(body, appConfig)

	if (chatConfig._id !== configId) {
		throw new HTTPError(400, "Config ID in request body does not match URL parameter")
	}

	const existing = await store.getChatConfig(configId)
	if (!existing) {
		throw new HTTPError(404, "Chat config not found")
	}

	if (!canUpdateChatConfig(user, appConfig.APP_ROLES, existing, chatConfig)) {
		throw new HTTPError(403, "Not authorized to update this chat config")
	}

	const chatConfigUpdateData: NewChatConfig = {
		...omitChatConfigId(chatConfig),
		created: existing.created,
		updated: { at: new Date().toISOString(), by: { id: user.userId, name: user.name } }
	}
	return store.replaceChatConfig(configId, chatConfigUpdateData)
}
```

3. In `deleteChatConfig`, replace `canUpdateChatConfig` with `canDeleteChatConfig`:
```typescript
export const deleteChatConfig = async (configId: string, user: AuthenticatedPrincipal, appConfig: AppConfig, store: IChatConfigStore): Promise<void> => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	const existing = await store.getChatConfig(configId)
	if (!existing) {
		throw new HTTPError(404, "Chat config not found")
	}

	if (!canDeleteChatConfig(user, appConfig.APP_ROLES, existing)) {
		throw new HTTPError(403, "Not authorized to delete this chat config")
	}

	await store.deleteChatConfig(configId)
}
```

- [ ] **Step 2.4: Run tests**

```bash
cd /Users/fuzzbin/Documents/GitHub_TFK/hugin-beta && npm run test:unit -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|replaceChatConfig|deleteChatConfig"
```

Expected: all new tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/server/services/chat-config-service.ts tests/server/api/chat-config-service.test.ts
git commit -m "fix: reconcile config ID in replaceChatConfig; restrict delete to owners and admins only"
```

---

## Task 3 — Fix critical auth bypass: fetch config from DB before canPromptConfig

**Fixes:** #1 (client-supplied `shared: true` bypasses canPromptConfig)

**Files:**
- Modify: `src/routes/api/chat/+server.ts`

No unit test is written here (the route requires full SvelteKit integration context), but the fix is verifiable by reading the code. The existing `authorization.test.ts` covers `canPromptConfig` logic; the route fix ensures the right object is passed to it.

- [ ] **Step 3.1: Read the current handler and understand the flow**

The current `/api/chat` handler parses the chat config entirely from the request body, then calls `canPromptConfig(user, APP_CONFIG, chatRequest.config)`. The `chatRequest.config.shared` field comes from the client and is trusted. An attacker sends `config.shared: true` to bypass access checks.

Fix: Fetch the real config from DB. Use DB values for auth. Merge only the `conversationId` from the client (session-specific state).

- [ ] **Step 3.2: Update `src/routes/api/chat/+server.ts`**

```typescript
import { json, type RequestHandler } from "@sveltejs/kit"
import { canPromptConfig } from "$lib/authorization"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseChatRequest } from "$lib/validation/parse-chat-request"

const chatConfigStore = getChatConfigStore()

const supahChat: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const contentLength = Number(requestEvent.request.headers.get("content-length") || 0)
	if (contentLength > APP_CONFIG.BODY_SIZE_LIMIT_BYTES) {
		throw new HTTPError(413, `Request body is too large. Limit is ${APP_CONFIG.BODY_SIZE_LIMIT_BYTES} bytes.`)
	}

	let body: unknown
	try {
		body = await requestEvent.request.json()
	} catch (error) {
		if (error instanceof Error && /too large|body size|request entity|payload/i.test(error.message)) {
			throw new HTTPError(413, `Request body is too large. Limit is ${APP_CONFIG.BODY_SIZE_LIMIT_BYTES} bytes.`)
		}
		throw new HTTPError(400, "Invalid JSON request body")
	}

	const chatRequest = parseChatRequest(body, APP_CONFIG)

	// Always verify authorization against the database record, not the client-supplied config.
	// The client cannot be trusted to supply correct shared/accessGroups/type values.
	const dbConfig = await chatConfigStore.getChatConfig(chatRequest.config._id)
	if (!dbConfig) {
		throw new HTTPError(404, "Chat configuration not found")
	}

	if (!canPromptConfig(user, APP_CONFIG, dbConfig)) {
		throw new HTTPError(403, "Not authorized to use this chat configuration")
	}

	// Use DB config as the authoritative source, but carry over the session-specific conversationId
	// that the client maintains across turns.
	const resolvedConfig = { ...dbConfig, conversationId: chatRequest.config.conversationId }
	const resolvedRequest = { ...chatRequest, config: resolvedConfig }

	const vendor = getVendor(resolvedRequest.config.vendorId)

	if (resolvedRequest.stream) {
		const stream = await vendor.createChatResponseStream(resolvedRequest)
		return {
			isAuthorized: true,
			response: responseStream(stream)
		}
	}

	const response = await vendor.createChatResponse(resolvedRequest)

	return {
		isAuthorized: true,
		response: json(response)
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, supahChat)
}
```

- [ ] **Step 3.3: Run full test suite to check for regressions**

```bash
cd /Users/fuzzbin/Documents/GitHub_TFK/hugin-beta && npm run test:unit 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3.4: Commit**

```bash
git add src/routes/api/chat/+server.ts
git commit -m "fix(security): fetch config from DB before canPromptConfig to prevent shared-flag auth bypass"
```

---

## Task 4 — Sanitize provider error data exposed to clients

**Fixes:** #3 (providerMessage/providerBody sent in API response)

**Files:**
- Modify: `src/lib/server/middleware/external-error.ts`
- Modify: `tests/server/api/external-error.test.ts`

- [ ] **Step 4.1: Write failing test**

In `tests/server/api/external-error.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { externalErrorToHTTPError } from "$lib/server/middleware/external-error"

class FakeProviderError extends Error {
  status: number
  body: string
  constructor(status: number, message: string, body: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

describe("externalErrorToHTTPError", () => {
  it("returns null for non-Error values", () => {
    expect(externalErrorToHTTPError("not an error", "OpenAI")).toBeNull()
    expect(externalErrorToHTTPError(null, "OpenAI")).toBeNull()
    expect(externalErrorToHTTPError({ status: 400 }, "OpenAI")).toBeNull()
  })

  it("returns null for errors without a numeric status/statusCode", () => {
    expect(externalErrorToHTTPError(new Error("network failure"), "OpenAI")).toBeNull()
  })

  it("maps provider 429 to HTTP 429", () => {
    const err = new FakeProviderError(429, "Rate limited", "")
    const result = externalErrorToHTTPError(err, "OpenAI")
    expect(result?.status).toBe(429)
  })

  it("maps provider 401 to HTTP 502 (auth is internal)", () => {
    const err = new FakeProviderError(401, "Unauthorized", "")
    const result = externalErrorToHTTPError(err, "OpenAI")
    expect(result?.status).toBe(502)
  })

  it("does NOT include providerMessage or providerBody in the error data sent to clients", () => {
    const err = new FakeProviderError(429, "Rate limit exceeded with internal context", JSON.stringify({ secret: "internal" }))
    const result = externalErrorToHTTPError(err, "OpenAI")
    expect(result).not.toBeNull()
    const data = result!.data as Record<string, unknown>
    expect(data).not.toHaveProperty("providerMessage")
    expect(data).not.toHaveProperty("providerBody")
  })

  it("includes only provider name and status in client-facing data", () => {
    const err = new FakeProviderError(400, "Bad input", "error body text")
    const result = externalErrorToHTTPError(err, "Mistral")
    expect(result).not.toBeNull()
    const data = result!.data as Record<string, unknown>
    expect(data.provider).toBe("Mistral")
    expect(data.providerStatus).toBe(400)
  })
})
```

- [ ] **Step 4.2: Run to confirm failing**

```bash
cd /Users/fuzzbin/Documents/GitHub_TFK/hugin-beta && npm run test:unit -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|providerMessage|providerBody|externalError"
```

- [ ] **Step 4.3: Fix `external-error.ts`**

Remove `providerMessage` and `providerBody` from the HTTPError data. Log them server-side only. The full `src/lib/server/middleware/external-error.ts`:

```typescript
import { logger } from "@vestfoldfylke/loglady"
import { HTTPError } from "./http-error"

type ErrorLikeWithStatus = Error & {
	status?: unknown
	statusCode?: unknown
	body?: unknown
}

const isErrorLikeWithStatus = (error: unknown): error is ErrorLikeWithStatus => error instanceof Error

const providerStatusToHttpStatus = (status: number): number => {
	if (status === 400 || status === 413 || status === 415 || status === 429) return status
	if (status === 401 || status === 403) return 502
	if (status >= 400 && status < 500) return 400
	return 502
}

export const externalErrorToHTTPError = (error: unknown, providerName: string): HTTPError | null => {
	if (!isErrorLikeWithStatus(error)) return null
	const status = typeof error.statusCode === "number" ? error.statusCode : typeof error.status === "number" ? error.status : null
	if (!status) return null

	const isLikelySizeError = status === 413 || /too large|payload|file size|request entity/i.test(error.message)
	const httpStatus = isLikelySizeError ? 413 : providerStatusToHttpStatus(status)
	const message = isLikelySizeError ? `${providerName} rejected the request because the uploaded file or request body is too large` : `${providerName} rejected the request`

	// Log detailed error server-side only — do not include in client response
	logger.warn(`[externalErrorToHTTPError] ${providerName} error ${status}: ${error.message}`)

	return new HTTPError(httpStatus, message, {
		provider: providerName,
		providerStatus: status
	})
}
```

- [ ] **Step 4.4: Run tests**

```bash
cd /Users/fuzzbin/Documents/GitHub_TFK/hugin-beta && npm run test:unit -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|externalError"
```

Expected: all tests PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/server/middleware/external-error.ts tests/server/api/external-error.test.ts
git commit -m "fix(security): strip providerMessage and providerBody from client-facing error responses"
```

---

## Task 5 — Fix SSE flush crash on split final chunk

**Fixes:** #6 (sseParser.flush() throws when last chunk is split across reads)

**Files:**
- Modify: `src/lib/components/Chat/PostChatMessage.svelte.ts`

This is a client-side Svelte file. There are no unit tests for it in the server test suite. The fix is verified by reading the logic and by the existing streaming test.

- [ ] **Step 5.1: Fix the streaming loop in `PostChatMessage.svelte.ts`**

The issue is on line 78: `done ? [...sseParser.push(chatResponseText), ...sseParser.flush()] : sseParser.push(chatResponseText)`. When `done=true`, if there is remaining buffered data that doesn't form a complete event, `flush()` throws. This crash propagates to the outer catch which tries to mutate `chatResponseObject` before `response.started` has fired, masking the error.

Replace the `while (true)` loop body with:

```typescript
			while (true) {
				const { value, done } = await reader.read()
				const chatResponseText = decoder.decode(value, { stream: !done })
				const chatResponse = sseParser.push(chatResponseText)
				if (done) {
					try {
						chatResponse.push(...sseParser.flush())
					} catch (flushError) {
						// A partial event at stream end is non-fatal — log and continue processing
						// events already parsed from prior chunks.
						console.warn("SSE stream ended with incomplete event (ignored):", flushError)
					}
				}
				for (const chatResult of chatResponse) {
					switch (chatResult.event) {
```

The rest of the switch statement remains identical. The closing of the while loop (`if (done) break`) remains as-is.

- [ ] **Step 5.2: Run full tests**

```bash
cd /Users/fuzzbin/Documents/GitHub_TFK/hugin-beta && npm run test:unit 2>&1 | tail -10
```

Expected: all tests pass (no regressions).

- [ ] **Step 5.3: Commit**

```bash
git add src/lib/components/Chat/PostChatMessage.svelte.ts
git commit -m "fix: handle partial final SSE chunk gracefully instead of crashing stream"
```

---

## Task 6 — Fix mongo-db replaceOne silent phantom return

**Fixes:** #7 (replaceOne ignores modifiedCount → returns fabricated config when doc deleted mid-op)

**Files:**
- Modify: `src/lib/server/db/mongo-db.ts`

- [ ] **Step 6.1: Fix `replaceChatConfig` in `mongo-db.ts`**

Find the `replaceChatConfig` method (around line 81) and replace it:

```typescript
	async replaceChatConfig(configId: string, chatConfig: NewChatConfig): Promise<ChatConfig> {
		if (!isValidObjectId(configId)) {
			throw new Error("Invalid ObjectId")
		}
		const db = await this.getDb()
		const collection: Collection<DbChatConfig> = db.collection(this.collectionName)
		const result = await collection.replaceOne({ _id: new ObjectId(configId) }, chatConfig)
		if (result.modifiedCount === 0) {
			throw new HTTPError(404, "Chat config not found or was deleted before update could complete")
		}
		return { ...chatConfig, _id: configId }
	}
```

Add the import for HTTPError at the top of `mongo-db.ts` if not already present:
```typescript
import { HTTPError } from "$lib/server/middleware/http-error"
```

- [ ] **Step 6.2: Run tests**

```bash
cd /Users/fuzzbin/Documents/GitHub_TFK/hugin-beta && npm run test:unit 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6.3: Commit**

```bash
git add src/lib/server/db/mongo-db.ts
git commit -m "fix: check modifiedCount after replaceOne to detect concurrent deletes"
```

---

## Task 7 — Fix missing JSON guard in POST /api/chatconfigs

**Fixes:** #10 (request.json() without try/catch in chatconfigs POST)

**Files:**
- Modify: `src/routes/api/chatconfigs/+server.ts`

- [ ] **Step 7.1: Fix the POST handler**

Replace the `createChatConfigHandler` in `src/routes/api/chatconfigs/+server.ts`:

```typescript
const createChatConfigHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	let body: unknown
	try {
		body = await requestEvent.request.json()
	} catch {
		throw new HTTPError(400, "Invalid JSON request body")
	}
	const newConfig = await createChatConfig(body, user, APP_CONFIG, chatConfigStore)
	return { isAuthorized: true, response: json(newConfig) }
}
```

Add the import for `HTTPError`:
```typescript
import { HTTPError } from "$lib/server/middleware/http-error"
```

- [ ] **Step 7.2: Run tests**

```bash
cd /Users/fuzzbin/Documents/GitHub_TFK/hugin-beta && npm run test:unit 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7.3: Commit**

```bash
git add src/routes/api/chatconfigs/+server.ts
git commit -m "fix: wrap request.json() in try/catch in POST /api/chatconfigs to return 400 on malformed body"
```

---

## Task 8 — Run full test suite and verify all fixes

- [ ] **Step 8.1: Run full test suite**

```bash
cd /Users/fuzzbin/Documents/GitHub_TFK/hugin-beta && npm run test 2>&1 | tail -40
```

Expected: TypeScript check, linting, build, and all unit tests pass.

- [ ] **Step 8.2: Fix any type errors or lint issues surfaced by the full suite**

If `npm run test` reports type errors (e.g. from the mongo-db HTTPError import or the authorization.ts changes), fix them before proceeding.

- [ ] **Step 8.3: Update REFACTOR_PLAN.md progress log**

In `REFACTOR_PLAN.md`, add a dated entry to the progress log section documenting the fixes applied. Search for an existing "Progress Log" section and add:

```markdown
### 2026-05-28 — Security & Quality Fix Pass

Applied fixes for 10 confirmed issues found in branch code review:
- **Critical (fixed):** Client-supplied `shared` flag auth bypass in `/api/chat` — now fetches config from DB
- **High (fixed):** AgentMaintainer could delete any published config — added `canDeleteChatConfig` (owner/admin only)
- **High (fixed):** Provider error body leaked to clients via `external-error.ts` — stripped from response
- **Medium (fixed):** Config ID mismatch in `replaceChatConfig` returned 500 — now returns 400
- **Medium (fixed):** SSE streaming crash on split final chunk — flush errors now non-fatal
- **Medium (fixed):** `replaceOne` in mongo-db ignored `modifiedCount` — now throws 404 on phantom update
- **Low (fixed):** `getUserRoleAccessGroups` pushed 'student' twice for EduEmployee+Student users
- **Low (fixed):** `canPromptConfig` duplicated role-to-group logic — now uses `getUserRoleAccessGroups`
- **Low (fixed):** POST `/api/chatconfigs` missing `try/catch` on `request.json()`
- **Note:** Content-Length bypass (#5) is a known limitation of header-based pre-read checks; enforced at infrastructure layer
```

- [ ] **Step 8.4: Final commit**

```bash
git add REFACTOR_PLAN.md
git commit -m "docs: record security/quality fix pass in REFACTOR_PLAN progress log"
```

---

## Notes on Finding #5 (Content-Length bypass)

The Content-Length pre-read guard in `/api/chat` cannot defend against chunked-transfer-encoded requests at the application level. This is a known limitation documented above. The correct mitigation is at the infrastructure layer (reverse proxy body size limit — e.g. Nginx `client_max_body_size`). The existing fallback catch on `request.json()` error messages provides partial protection for framework-enforced limits. No application-level code change is made for this finding.
