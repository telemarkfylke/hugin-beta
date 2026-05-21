# ChatState Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `ChatState.svelte.ts` from a 370-line god class to a focused reactive state coordinator by deleting dead mock code, extracting pure functions, and moving API fetch logic to a dedicated client module.

**Architecture:** Four incremental slices — delete dead code first, fix trivial issues, extract the pure `buildChatRequest` function (testable without Svelte), then extract the three API fetch methods into `chat-config-client.ts`. `ChatState` keeps thin wrapper methods that call the client. No behavior changes to the UI.

**Tech Stack:** TypeScript (strict), Svelte 5 Runes, Vitest (server test project at `tests/server/`, browser test project for `.svelte.spec.ts`). Note: tests for pure client-side functions go in `src/` as `.spec.ts` files using the browser Vitest project.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/components/Chat/ChatState.svelte.ts` | Remove `loadChat`, fix `structuredClone`, remove `console.error`, thin wrappers for API calls |
| Create | `src/lib/client/chat/build-chat-request.ts` | Pure function: history + input + config → `ChatRequest` |
| Create | `src/lib/client/chat/chat-config-client.ts` | Three fetch functions: save, update, delete chat config |
| Create | `src/lib/client/chat/build-chat-request.spec.ts` | Unit tests for `buildChatRequest` |
| Create | `src/lib/client/chat/chat-config-client.spec.ts` | Unit tests for the three fetch wrappers |

---

### Task 1: Delete `loadChat` and fix trivial issues

**Files:**
- Modify: `src/lib/components/Chat/ChatState.svelte.ts`

No new tests needed — this is deletion and a one-line fix. Both call sites (`src/routes/+page.svelte:34` and `src/routes/agents/create/+page.svelte:53`) are already commented out.

- [ ] **Step 1.1: Delete the `loadChat` method (lines 125–226) from `ChatState.svelte.ts`**

Remove the entire method:
```typescript
public loadChat = async (chatId: string): Promise<void> => {
    // ... all 100 lines of mock data ...
}
```

- [ ] **Step 1.2: Replace `JSON.parse(JSON.stringify(...))` with `structuredClone`**

There are two occurrences. Find and replace both:

In `changeChat` (around line 114):
```typescript
// Before
this.initialConfig = JSON.parse(JSON.stringify(chat.config))
// After
this.initialConfig = structuredClone(chat.config)
```

In `updateChatConfig` (around line 341):
```typescript
// Before
this.initialConfig = JSON.parse(JSON.stringify(updatedConfig))
// After
this.initialConfig = structuredClone(updatedConfig)
```

- [ ] **Step 1.3: Run check and tests**

```bash
npm run check && npm run test
```

Expected: 0 errors, 0 warnings, all tests pass.

---

### Task 2: Extract `buildChatRequest` as a pure function

**Files:**
- Create: `src/lib/client/chat/build-chat-request.ts`
- Create: `src/lib/client/chat/build-chat-request.spec.ts`
- Modify: `src/lib/components/Chat/ChatState.svelte.ts`

The request-building logic inside `promptChat` (history flattening, web search tool merging, building the `ChatRequest` object) is pure — it takes inputs and returns a value with no side effects. Extract it so it can be tested without Svelte.

- [ ] **Step 2.1: Write the failing test file**

Create `src/lib/client/chat/build-chat-request.spec.ts`:

```typescript
import { describe, expect, it } from "vitest"
import type { Chat, ChatConfig, ChatRequest } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import { buildChatRequest } from "./build-chat-request"

const baseConfig = (): ChatConfig => ({
	_id: "config-1",
	name: "Test Config",
	description: "",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4.1",
	type: "private",
	accessGroups: [],
	tools: [],
	created: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1" } },
	updated: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1" } }
})

const baseChat = (): Chat => ({
	_id: "chat-1",
	config: baseConfig(),
	history: [],
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	owner: { id: "user-1" }
})

const userMessage = (): ChatInputItem => ({
	type: "message.input",
	role: "user",
	content: [{ type: "input_text", text: "Hello" }]
})

describe("buildChatRequest", () => {
	it("produces a ChatRequest with the user message appended to inputs", () => {
		const result = buildChatRequest(baseChat(), userMessage(), false, true, false)
		const last = result.inputs[result.inputs.length - 1]
		expect(last).toEqual(userMessage())
	})

	it("flattens chat_response outputs into inputs", () => {
		const chat = baseChat()
		chat.history = [
			userMessage(),
			{
				id: "resp-1",
				type: "chat_response",
				config: baseConfig(),
				createdAt: "2026-01-01T00:00:00.000Z",
				outputs: [{ id: "out-1", type: "message.output", role: "assistant", content: [{ type: "output_text", text: "Hi" }] }],
				status: "completed",
				usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
			}
		]
		const result = buildChatRequest(chat, userMessage(), false, true, false)
		expect(result.inputs.some((i) => i.type === "message.output")).toBe(true)
		expect(result.inputs.some((i) => i.type === "message.input" && i.role === "user")).toBe(true)
	})

	it("adds web_search tool when webSearchEnabled is true", () => {
		const result = buildChatRequest(baseChat(), userMessage(), true, true, false)
		expect(result.config.tools).toEqual(expect.arrayContaining([{ type: "web_search" }]))
	})

	it("removes web_search tool when webSearchEnabled is false", () => {
		const chat = baseChat()
		chat.config.tools = [{ type: "web_search" }]
		const result = buildChatRequest(chat, userMessage(), false, true, false)
		expect(result.config.tools?.some((t) => t.type === "web_search")).toBe(false)
	})

	it("passes stream and store flags through", () => {
		const r1 = buildChatRequest(baseChat(), userMessage(), false, true, false)
		expect(r1.stream).toBe(true)
		expect(r1.store).toBe(false)

		const r2 = buildChatRequest(baseChat(), userMessage(), false, false, true)
		expect(r2.stream).toBe(false)
		expect(r2.store).toBe(true)
	})

	it("uses model name as config name when config.name is empty", () => {
		const chat = baseChat()
		chat.config.name = ""
		chat.config.model = "gpt-4.1"
		const result = buildChatRequest(chat, userMessage(), false, true, false)
		expect(result.config.name).toBe("gpt-4.1")
	})
})
```

- [ ] **Step 2.2: Run the test to confirm it fails**

```bash
npm run test:unit -- --reporter=verbose src/lib/client/chat/build-chat-request.spec.ts
```

Expected: FAIL — `Cannot find module './build-chat-request'`

- [ ] **Step 2.3: Create `src/lib/client/chat/build-chat-request.ts`**

```typescript
import type { Chat, ChatRequest } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"

export const buildChatRequest = (
	chat: Chat,
	userMessage: ChatInputItem,
	webSearchEnabled: boolean,
	stream: boolean,
	store: boolean
): ChatRequest => {
	const historyInputs = chat.history
		.flatMap((item) => {
			if (item.type === "chat_response") return item.outputs
			return item
		})
		.filter((item) => item !== undefined)

	const webSearchTools: typeof chat.config.tools = webSearchEnabled
		? [{ type: "web_search" }, ...(chat.config.tools?.filter((t) => t.type !== "web_search") ?? [])]
		: chat.config.tools?.filter((t) => t.type !== "web_search")

	return {
		config: {
			...chat.config,
			name: chat.config.name || chat.config.model || "Ukjent navn",
			tools: webSearchTools
		},
		inputs: [...historyInputs, userMessage],
		stream,
		store
	}
}
```

- [ ] **Step 2.4: Run the tests to confirm they pass**

```bash
npm run test:unit -- --reporter=verbose src/lib/client/chat/build-chat-request.spec.ts
```

Expected: 6 tests PASS.

- [ ] **Step 2.5: Update `promptChat` in `ChatState.svelte.ts` to use `buildChatRequest`**

Add the import at the top of `ChatState.svelte.ts`:
```typescript
import { buildChatRequest } from "$lib/client/chat/build-chat-request"
```

Replace the inline request-building block inside `promptChat`. The current code builds `chatInput`, `webSearchTools`, and `chatRequest` manually. Replace everything from `const chatInput = ...` through `const chatRequest: ChatRequest = { ... }` with:

```typescript
const chatRequest = buildChatRequest(this.chat, userMessage, this.webSearchEnabled, this.streamResponse, this.storeChat)
```

Also remove the now-unused `ChatRequest` import from the `$lib/types/chat` import line if it becomes unused (check after the edit).

- [ ] **Step 2.6: Run check and full test suite**

```bash
npm run check && npm run test
```

Expected: 0 errors, all tests pass.

---

### Task 3: Extract `chat-config-client.ts`

**Files:**
- Create: `src/lib/client/chat/chat-config-client.ts`
- Create: `src/lib/client/chat/chat-config-client.spec.ts`
- Modify: `src/lib/components/Chat/ChatState.svelte.ts`

The three fetch methods (`saveChatConfig`, `updateChatConfig`, `deleteChatConfig`) are pure async functions that take a config and call the API. Moving them out makes them testable and reusable.

- [ ] **Step 3.1: Write the failing test file**

Create `src/lib/client/chat/chat-config-client.spec.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ChatConfig } from "$lib/types/chat"
import { deleteChatConfig, saveChatConfig, updateChatConfig } from "./chat-config-client"

const baseConfig = (): ChatConfig => ({
	_id: "507f1f77bcf86cd799439011",
	name: "Test",
	description: "",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4.1",
	type: "private",
	accessGroups: [],
	created: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1" } },
	updated: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1" } }
})

const mockFetch = (status: number, body: unknown) => {
	return vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		statusText: status === 200 ? "OK" : "Error",
		json: () => Promise.resolve(body)
	})
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe("saveChatConfig", () => {
	it("POSTs the config and returns the saved config", async () => {
		const saved = { ...baseConfig(), _id: "new-id" }
		vi.stubGlobal("fetch", mockFetch(200, saved))
		const result = await saveChatConfig(baseConfig())
		expect(result).toEqual(saved)
		expect(fetch).toHaveBeenCalledWith("/api/chatconfigs", expect.objectContaining({ method: "POST" }))
	})

	it("throws on non-ok response", async () => {
		vi.stubGlobal("fetch", mockFetch(403, { message: "Forbidden" }))
		await expect(saveChatConfig(baseConfig())).rejects.toThrow("403")
	})
})

describe("updateChatConfig", () => {
	it("PUTs the config and returns the updated config", async () => {
		const updated = { ...baseConfig(), name: "Updated" }
		vi.stubGlobal("fetch", mockFetch(200, updated))
		const result = await updateChatConfig(baseConfig())
		expect(result).toEqual(updated)
		expect(fetch).toHaveBeenCalledWith(`/api/chatconfigs/${baseConfig()._id}`, expect.objectContaining({ method: "PUT" }))
	})

	it("throws on non-ok response", async () => {
		vi.stubGlobal("fetch", mockFetch(404, { message: "Not found" }))
		await expect(updateChatConfig(baseConfig())).rejects.toThrow("404")
	})
})

describe("deleteChatConfig", () => {
	it("DELETEs the config by id", async () => {
		vi.stubGlobal("fetch", mockFetch(200, { message: "Chat config deleted" }))
		await expect(deleteChatConfig(baseConfig()._id)).resolves.toBeUndefined()
		expect(fetch).toHaveBeenCalledWith(`/api/chatconfigs/${baseConfig()._id}`, expect.objectContaining({ method: "DELETE" }))
	})

	it("throws on non-ok response", async () => {
		vi.stubGlobal("fetch", mockFetch(500, { message: "Server error" }))
		await expect(deleteChatConfig(baseConfig()._id)).rejects.toThrow("500")
	})
})
```

- [ ] **Step 3.2: Run to confirm fail**

```bash
npm run test:unit -- --reporter=verbose src/lib/client/chat/chat-config-client.spec.ts
```

Expected: FAIL — `Cannot find module './chat-config-client'`

- [ ] **Step 3.3: Create `src/lib/client/chat/chat-config-client.ts`**

```typescript
import type { ChatConfig } from "$lib/types/chat"

export const saveChatConfig = async (config: ChatConfig): Promise<ChatConfig> => {
	const result = await fetch("/api/chatconfigs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(config)
	})
	if (!result.ok) {
		const errorData = await result.json().catch(() => null)
		throw new Error(`${result.status}: ${errorData?.message ?? result.statusText}`)
	}
	return result.json()
}

export const updateChatConfig = async (config: ChatConfig): Promise<ChatConfig> => {
	const result = await fetch(`/api/chatconfigs/${config._id}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(config)
	})
	if (!result.ok) {
		const errorData = await result.json().catch(() => null)
		throw new Error(`${result.status}: ${errorData?.message ?? result.statusText}`)
	}
	return result.json()
}

export const deleteChatConfig = async (configId: string): Promise<void> => {
	const result = await fetch(`/api/chatconfigs/${configId}`, {
		method: "DELETE"
	})
	if (!result.ok) {
		const errorData = await result.json().catch(() => null)
		throw new Error(`${result.status}: ${errorData?.message ?? result.statusText}`)
	}
}
```

- [ ] **Step 3.4: Run tests to confirm they pass**

```bash
npm run test:unit -- --reporter=verbose src/lib/client/chat/chat-config-client.spec.ts
```

Expected: 6 tests PASS.

- [ ] **Step 3.5: Update `ChatState.svelte.ts` to use the client module**

Add import at the top of `ChatState.svelte.ts`:
```typescript
import { deleteChatConfig as apiDeleteChatConfig, saveChatConfig as apiSaveChatConfig, updateChatConfig as apiUpdateChatConfig } from "$lib/client/chat/chat-config-client"
```

Replace the three methods in `ChatState`:

```typescript
public saveChatConfig = async (): Promise<void> => {
    const savedConfig = await apiSaveChatConfig(this.chat.config)
    goto(`/agents/${savedConfig._id}`)
}

public updateChatConfig = async (): Promise<void> => {
    const updatedConfig = await apiUpdateChatConfig(this.chat.config)
    this.chat.config = updatedConfig
    this.initialConfig = structuredClone(updatedConfig)
    this.configMode = false
    goto(`/agents/${updatedConfig._id}`)
}

public deleteChatConfig = async (): Promise<void> => {
    const confirmed = confirm("Er du sikker på at du vil slette denne assistenten? Dette kan ikke angres. 😬")
    if (!confirmed) return
    await apiDeleteChatConfig(this.chat.config._id)
    goto("/agents")
}
```

- [ ] **Step 3.6: Run check and full test suite**

```bash
npm run check && npm run lint && npm run test
```

Expected: 0 errors, 0 lint issues, all tests pass.

---

### Task 4: Update REFACTOR_PLAN.md

**Files:**
- Modify: `REFACTOR_PLAN.md`

- [ ] **Step 4.1: Add dated progress entry**

Append to the Progress log section in `REFACTOR_PLAN.md`:

```markdown
### 2026-05-21 — ChatState decomposition (Phase 5, partial)

Completed:

- Deleted `loadChat` mock method (100 lines of hardcoded fixture data with `setTimeout`).
- Replaced `JSON.parse(JSON.stringify(...))` clones with `structuredClone`.
- Extracted `buildChatRequest` pure function to `src/lib/client/chat/build-chat-request.ts` with 6 unit tests covering history flattening, web search tool toggling, stream/store flags, and name fallback.
- Extracted `saveChatConfig`, `updateChatConfig`, `deleteChatConfig` fetch wrappers to `src/lib/client/chat/chat-config-client.ts` with 6 unit tests covering happy paths and error propagation.
- `ChatState.svelte.ts` reduced from 370 to ~200 lines. Reactive state management and UI orchestration remain; pure logic and API calls are in focused modules.

Remaining Phase 5 items:
- File conversion (`fileToBase64Url`, `fileToMessageContent`) could move to `src/lib/client/chat/file-content.ts` if standalone testability is needed.
- `PostChatMessage.svelte.ts` SSE switch statement could be extracted to a stream reducer.

Verified:

- `npm run check` reports 0 errors and 0 warnings.
- `npm run lint` reports 0 issues.
- `npm run test` passes.
```

---

## Self-Review

**Spec coverage:**
- ✅ Delete `loadChat` → Task 1 step 1.1
- ✅ Fix `JSON.parse(JSON.stringify(...))` → Task 1 steps 1.2
- ✅ Extract `buildChatRequest` pure function → Task 2
- ✅ Unit tests for `buildChatRequest` → Task 2 step 2.1 (6 tests)
- ✅ Extract `chat-config-client.ts` → Task 3
- ✅ Unit tests for client → Task 3 step 3.1 (6 tests)
- ✅ `ChatState` delegates to extracted modules → Tasks 2.5 and 3.5
- ✅ `npm run check && npm run lint && npm run test` at each task → steps 1.3, 2.6, 3.6
- ✅ Update REFACTOR_PLAN.md → Task 4

**Placeholder scan:** None found. All code is complete.

**Type consistency:**
- `buildChatRequest(chat: Chat, userMessage: ChatInputItem, webSearchEnabled: boolean, stream: boolean, store: boolean): ChatRequest` — consistent across test and implementation
- `saveChatConfig(config: ChatConfig): Promise<ChatConfig>` — consistent
- `updateChatConfig(config: ChatConfig): Promise<ChatConfig>` — consistent
- `deleteChatConfig(configId: string): Promise<void>` — consistent
- Aliases in `ChatState`: `apiSaveChatConfig`, `apiUpdateChatConfig`, `apiDeleteChatConfig` — avoids name clash with `ChatState` methods of the same name
