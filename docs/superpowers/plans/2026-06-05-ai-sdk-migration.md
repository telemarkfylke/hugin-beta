# AI SDK Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bespoke vendor abstraction layer (IAIVendor, mapping files, stream handlers, MuginSse SSE protocol, PostChatMessage) with the Vercel AI SDK, covering OpenAI and Mistral with text streaming, file uploads, and web search.

**Architecture:** The server-side `/api/chat` route is rewritten to call `streamText()` from the `ai` package, returning `result.toUIMessageStreamResponse()`. A thin `resolveModel()` factory replaces the entire vendor registry and all vendor classes. The AI SDK `Chat` class sends messages in its own wire format — the server reads `messages` (AI SDK `CoreMessage[]`) directly from the request body instead of the old `inputs` array. The client-side `ChatState.svelte.ts` is rewritten around the `Chat` class from `@ai-sdk/svelte`, which manages streaming, history, and error state natively. The hand-rolled SSE protocol (`MuginSse`, `streaming.ts`, `PostChatMessage.svelte.ts`) is deleted entirely.

**Tech Stack:** `ai` (AI SDK Core), `@ai-sdk/openai`, `@ai-sdk/mistral`, `@ai-sdk/svelte`, SvelteKit, TypeScript, Vitest, Biome

---

## Scope

**In scope:**
- OpenAI (text streaming, file uploads, web search + URL citations)
- Mistral (text streaming, file uploads, web search + URL citations)
- Full client-side rewrite using `@ai-sdk/svelte` `Chat` class

**Out of scope (deferred):**
- Ollama, LiteLLM vendors
- Vendor agents (`vendorAgent.id` / BYOB feature)
- MongoDB conversation persistence

---

## File Map

### New files
- `src/lib/server/ai-sdk/resolve-model.ts` — maps `ChatConfig` → AI SDK `LanguageModel`; handles per-project API keys for OpenAI and Mistral
- `src/lib/server/ai-sdk/resolve-messages.ts` — converts `ChatInputItem[]` (existing history format) to AI SDK `CoreMessage[]`
- `src/lib/server/ai-sdk/resolve-tools.ts` — maps `ChatTool[]` from config to AI SDK tool definitions (web search)

### Modified files
- `src/routes/api/chat/+server.ts` — replace vendor calls with `streamText()` + `resolveModel()`
- `src/lib/components/Chat/ChatState.svelte.ts` — rewrite `promptChat` around `@ai-sdk/svelte` `Chat` class; remove all SSE/streaming code
- `package.json` — add `ai`, `@ai-sdk/openai`, `@ai-sdk/mistral`, `@ai-sdk/svelte`

### Deleted files (at end, after everything works)
- `src/lib/server/ai-vendors.ts`
- `src/lib/types/AIVendor.ts`
- `src/lib/types/streaming.ts`
- `src/lib/streaming.ts`
- `src/lib/components/Chat/PostChatMessage.svelte.ts`
- `src/lib/server/openai/openai-vendor.ts`
- `src/lib/server/openai/openai-mapping.ts`
- `src/lib/server/openai/openai-stream.ts`
- `src/lib/server/openai/openai-files.ts`
- `src/lib/server/mistral/mistral-vendor.ts`
- `src/lib/server/mistral/mistral-mapping.ts`
- `src/lib/server/mistral/mistral-stream.ts`
- `src/lib/server/mistral/mistral-files.ts`

### Unchanged (keep as-is)
- `src/lib/authorization.ts`
- `src/lib/validation/parse-chat-config.ts`
- `src/lib/validation/file-input.ts`
- `src/lib/server/middleware/`
- `src/lib/server/auth/`
- `src/lib/server/app-config/`
- `src/lib/types/chat.ts`
- `src/lib/types/chat-item.ts`
- `src/lib/types/chat-item-content.ts`

---

## Task 1: Install AI SDK packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install ai @ai-sdk/openai @ai-sdk/mistral @ai-sdk/svelte
```

- [ ] **Step 2: Verify installation**

```bash
npm ls ai @ai-sdk/openai @ai-sdk/mistral @ai-sdk/svelte
```

Expected output: all four packages listed with version numbers, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install Vercel AI SDK packages"
```

---

## Task 2: Create `resolveModel` — the vendor registry replacement

This is a pure server-side utility. It takes a `ChatConfig` and returns an AI SDK `LanguageModel`. It handles per-project API keys the same way the current vendors do (reading from env).

**Files:**
- Create: `src/lib/server/ai-sdk/resolve-model.ts`
- Create: `tests/server/ai-sdk/resolve-model.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/server/ai-sdk/resolve-model.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest"

vi.mock("$env/dynamic/private", () => ({
  env: {
    OPENAI_API_KEY_PROJECT_DEFAULT: "test-openai-key",
    OPENAI_API_KEY_PROJECT_SCHOOL: "test-openai-school-key",
    MISTRAL_API_KEY_PROJECT_DEFAULT: "test-mistral-key",
  }
}))

// We only test that resolveModel returns an object (LanguageModel is opaque),
// and that it throws for unknown vendors/missing keys.
describe("resolveModel", () => {
  it("returns a model object for OPENAI DEFAULT project", async () => {
    const { resolveModel } = await import("../../../src/lib/server/ai-sdk/resolve-model")
    const model = resolveModel({ vendorId: "OPENAI", project: "DEFAULT", model: "gpt-4o" } as any)
    expect(model).toBeDefined()
    expect(typeof model).toBe("object")
  })

  it("returns a model object for MISTRAL DEFAULT project", async () => {
    const { resolveModel } = await import("../../../src/lib/server/ai-sdk/resolve-model")
    const model = resolveModel({ vendorId: "MISTRAL", project: "DEFAULT", model: "mistral-large-latest" } as any)
    expect(model).toBeDefined()
    expect(typeof model).toBe("object")
  })

  it("throws HTTPError 400 for unsupported vendorId", async () => {
    const { resolveModel } = await import("../../../src/lib/server/ai-sdk/resolve-model")
    const { HTTPError } = await import("../../../src/lib/server/middleware/http-error")
    expect(() => resolveModel({ vendorId: "UNKNOWN" as any, project: "DEFAULT", model: "gpt-4o" } as any)).toThrow(HTTPError)
  })

  it("throws HTTPError 500 for missing API key", async () => {
    const { resolveModel } = await import("../../../src/lib/server/ai-sdk/resolve-model")
    const { HTTPError } = await import("../../../src/lib/server/middleware/http-error")
    expect(() => resolveModel({ vendorId: "OPENAI", project: "NOKEY", model: "gpt-4o" } as any)).toThrow(HTTPError)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:unit -- tests/server/ai-sdk/resolve-model.test.ts --run
```

Expected: FAIL — `resolve-model.ts` does not exist yet.

- [ ] **Step 3: Create `resolve-model.ts`**

Create `src/lib/server/ai-sdk/resolve-model.ts`:

```typescript
import { createMistral } from "@ai-sdk/mistral"
import { createOpenAI } from "@ai-sdk/openai"
import { env } from "$env/dynamic/private"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { ChatConfig } from "$lib/types/chat"
import type { LanguageModel } from "ai"

const getApiKey = (prefix: string, project: string): string => {
  const key = env[`${prefix}_API_KEY_PROJECT_${project}`]
  if (!key) {
    throw new HTTPError(500, `Missing API key: ${prefix}_API_KEY_PROJECT_${project}`)
  }
  return key
}

export const resolveModel = (config: ChatConfig): LanguageModel => {
  switch (config.vendorId) {
    case "OPENAI": {
      const openai = createOpenAI({ apiKey: getApiKey("OPENAI", config.project) })
      return openai(config.model ?? "gpt-4o")
    }
    case "MISTRAL": {
      const mistral = createMistral({ apiKey: getApiKey("MISTRAL", config.project) })
      return mistral(config.model ?? "mistral-large-latest")
    }
    default:
      throw new HTTPError(400, `Unsupported vendorId: ${config.vendorId}`)
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:unit -- tests/server/ai-sdk/resolve-model.test.ts --run
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/ai-sdk/resolve-model.ts tests/server/ai-sdk/resolve-model.test.ts
git commit -m "feat: add resolveModel factory — maps ChatConfig to AI SDK LanguageModel"
```

---

## Task 3: Create `resolveMessages` — history format converter

The existing chat history uses the internal `ChatInputItem[]` format. AI SDK expects `CoreMessage[]`. This utility converts between them, handling text, images, and files.

**Files:**
- Create: `src/lib/server/ai-sdk/resolve-messages.ts`
- Create: `tests/server/ai-sdk/resolve-messages.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/server/ai-sdk/resolve-messages.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { resolveMessages } from "../../../src/lib/server/ai-sdk/resolve-messages"
import type { ChatInputItem } from "../../../src/lib/types/chat-item"

describe("resolveMessages", () => {
  it("converts a user text message", () => {
    const inputs: ChatInputItem[] = [
      {
        type: "message.input",
        role: "user",
        content: [{ type: "input_text", text: "Hello!" }]
      }
    ]
    const result = resolveMessages(inputs)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ role: "user", content: [{ type: "text", text: "Hello!" }] })
  })

  it("converts an assistant output message", () => {
    const inputs: ChatInputItem[] = [
      {
        id: "resp-1",
        type: "message.output",
        role: "assistant",
        content: [{ type: "output_text", text: "Hi there!" }]
      }
    ]
    const result = resolveMessages(inputs)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ role: "assistant", content: [{ type: "text", text: "Hi there!" }] })
  })

  it("converts a user message with an image", () => {
    const inputs: ChatInputItem[] = [
      {
        type: "message.input",
        role: "user",
        content: [
          { type: "input_image", imageUrl: "data:image/png;base64,abc123" },
          { type: "input_text", text: "What is this?" }
        ]
      }
    ]
    const result = resolveMessages(inputs)
    expect(result[0]).toMatchObject({
      role: "user",
      content: expect.arrayContaining([
        { type: "image", image: "data:image/png;base64,abc123" },
        { type: "text", text: "What is this?" }
      ])
    })
  })

  it("converts a user message with a file", () => {
    const inputs: ChatInputItem[] = [
      {
        type: "message.input",
        role: "user",
        content: [{ type: "input_file", fileName: "doc.pdf", fileUrl: "data:application/pdf;base64,abc123" }]
      }
    ]
    const result = resolveMessages(inputs)
    expect(result[0]).toMatchObject({
      role: "user",
      content: expect.arrayContaining([
        expect.objectContaining({ type: "file" })
      ])
    })
  })

  it("skips chat_response wrapper items, using only their outputs", () => {
    const inputs: ChatInputItem[] = [
      {
        type: "message.input",
        role: "user",
        content: [{ type: "input_text", text: "Hello" }]
      },
      {
        id: "resp-1",
        type: "message.output",
        role: "assistant",
        content: [{ type: "output_text", text: "Hi" }]
      }
    ]
    const result = resolveMessages(inputs)
    expect(result).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:unit -- tests/server/ai-sdk/resolve-messages.test.ts --run
```

Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Create `resolve-messages.ts`**

Create `src/lib/server/ai-sdk/resolve-messages.ts`:

```typescript
import type { CoreMessage, ImagePart, FilePart, TextPart } from "ai"
import type { ChatInputItem } from "$lib/types/chat-item"
import type { InputFile, InputImage, InputText, OutputText } from "$lib/types/chat-item-content"

const inputTextToPart = (content: InputText): TextPart => ({ type: "text", text: content.text })

const inputImageToPart = (content: InputImage): ImagePart => ({ type: "image", image: content.imageUrl })

const inputFileToPart = (content: InputFile): FilePart => {
  const mimeType = content.fileUrl.substring(
    content.fileUrl.indexOf(":") + 1,
    content.fileUrl.indexOf(";base64")
  )
  return {
    type: "file",
    data: content.fileUrl,
    mimeType: mimeType as `${string}/${string}`
  }
}

const outputTextToPart = (content: OutputText): TextPart => ({ type: "text", text: content.text })

export const resolveMessages = (inputs: ChatInputItem[]): CoreMessage[] => {
  const messages: CoreMessage[] = []

  for (const item of inputs) {
    if (item.type === "message.input") {
      const parts = item.content.map((c) => {
        switch (c.type) {
          case "input_text":  return inputTextToPart(c)
          case "input_image": return inputImageToPart(c)
          case "input_file":  return inputFileToPart(c)
        }
      })
      messages.push({ role: "user", content: parts })
    } else if (item.type === "message.output") {
      const parts = item.content
        .filter((c) => c.type === "output_text")
        .map((c) => outputTextToPart(c as OutputText))
      messages.push({ role: "assistant", content: parts })
    }
  }

  return messages
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:unit -- tests/server/ai-sdk/resolve-messages.test.ts --run
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/ai-sdk/resolve-messages.ts tests/server/ai-sdk/resolve-messages.test.ts
git commit -m "feat: add resolveMessages — converts internal ChatInputItem history to AI SDK CoreMessage[]"
```

---

## Task 4: Create `resolveTools` — web search tool mapping

Maps the internal `ChatTool[]` config (currently only `{ type: "web_search" }`) to AI SDK tool definitions. AI SDK handles web search via the `webSearchPreview` tool from `@ai-sdk/openai` for OpenAI, and via a provider option for Mistral.

**Files:**
- Create: `src/lib/server/ai-sdk/resolve-tools.ts`
- Create: `tests/server/ai-sdk/resolve-tools.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/server/ai-sdk/resolve-tools.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { resolveTools } from "../../../src/lib/server/ai-sdk/resolve-tools"
import type { ChatTool } from "../../../src/lib/types/chat"

describe("resolveTools", () => {
  it("returns undefined when tools is empty", () => {
    expect(resolveTools([], "OPENAI")).toBeUndefined()
  })

  it("returns undefined when tools is null/undefined", () => {
    expect(resolveTools(null, "OPENAI")).toBeUndefined()
    expect(resolveTools(undefined, "OPENAI")).toBeUndefined()
  })

  it("returns a tool object for OPENAI web_search", () => {
    const tools: ChatTool[] = [{ type: "web_search" }]
    const result = resolveTools(tools, "OPENAI")
    expect(result).toBeDefined()
    expect(result).toHaveProperty("webSearch")
    expect(typeof result?.webSearch).toBe("object")
  })

  it("returns a tool object for MISTRAL web_search", () => {
    const tools: ChatTool[] = [{ type: "web_search" }]
    const result = resolveTools(tools, "MISTRAL")
    expect(result).toBeDefined()
    expect(result).toHaveProperty("webSearch")
    expect(typeof result?.webSearch).toBe("object")
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:unit -- tests/server/ai-sdk/resolve-tools.test.ts --run
```

Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Create `resolve-tools.ts`**

Create `src/lib/server/ai-sdk/resolve-tools.ts`:

```typescript
import { mistral } from "@ai-sdk/mistral"
import { openai } from "@ai-sdk/openai"
import type { ChatConfig, ChatTool } from "$lib/types/chat"
import type { Tool } from "ai"

export const resolveTools = (
  tools: ChatTool[] | null | undefined,
  vendorId: ChatConfig["vendorId"]
): Record<string, Tool> | undefined => {
  if (!tools || tools.length === 0) return undefined

  const result: Record<string, Tool> = {}

  for (const tool of tools) {
    if (tool.type === "web_search") {
      if (vendorId === "MISTRAL") {
        result.webSearch = mistral.tools.webSearch()
      } else {
        result.webSearch = openai.tools.webSearchPreview()
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:unit -- tests/server/ai-sdk/resolve-tools.test.ts --run
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/ai-sdk/resolve-tools.ts tests/server/ai-sdk/resolve-tools.test.ts
git commit -m "feat: add resolveTools — maps ChatTool[] config to AI SDK tool definitions"
```

---

## Task 5: Rewrite the `/api/chat` route

Replace the vendor registry calls with `streamText()` using the three new utilities. The middleware, auth, and config validation are unchanged.

**Files:**
- Modify: `src/routes/api/chat/+server.ts`

- [ ] **Step 1: Read the current file**

Open `src/routes/api/chat/+server.ts` and note the current structure. The new version keeps:
- `parseChatRequest()` — unchanged
- `apiRequestMiddleware` — unchanged
- Auth + `canPromptConfig` check — unchanged

What changes: everything after the auth check replaces `getVendor()` + `vendor.createChatResponseStream()` with `streamText()`.

- [ ] **Step 2: Rewrite the file**

The AI SDK `Chat` class sends requests in its own format: `{ messages: UIMessage[], ...body }` where `body` is the extra data we pass via the `body` option in the constructor. Our config and stream flag travel in `body.config` and `body.stream`. The server reads `messages` (AI SDK format) directly — we no longer parse our old `inputs` array. We use `convertToCoreMessages()` from the `ai` package to convert the AI SDK `UIMessage[]` to `CoreMessage[]`.

Replace `src/routes/api/chat/+server.ts` with:

```typescript
import { convertToCoreMessages, streamText } from "ai"
import { type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canPromptConfig } from "$lib/authorization"
import { resolveModel } from "$lib/server/ai-sdk/resolve-model"
import { resolveTools } from "$lib/server/ai-sdk/resolve-tools"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseChatConfig } from "$lib/validation/parse-chat-config"

logger.logConfig({ prefix: "hugin - api/chat" })

const handleChat: ApiNextFunction = async ({ requestEvent, user }) => {
  if (!user.userId) throw new HTTPError(400, "userId is required")
  if (!requestEvent) throw new HTTPError(400, "No request event")

  const body = await requestEvent.request.json()

  if (typeof body !== "object" || body === null) {
    throw new HTTPError(400, "Invalid request body")
  }

  // AI SDK Chat sends: { messages: UIMessage[], config: ChatConfig, stream: boolean }
  const { messages: rawMessages, config: rawConfig } = body as { messages: unknown; config: unknown }

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    throw new HTTPError(400, "messages must be a non-empty array")
  }

  const config = parseChatConfig(rawConfig, APP_CONFIG)

  if (!canPromptConfig(user, APP_CONFIG, config)) {
    throw new HTTPError(403, "Not authorized to use this chat configuration")
  }

  const model = resolveModel(config)
  const messages = convertToCoreMessages(rawMessages)
  const tools = resolveTools(config.tools, config.vendorId)

  logger.info("Streaming chat — vendor: {vendorId}, model: {model}", config.vendorId, config.model ?? "default")

  const result = streamText({
    model,
    messages,
    system: config.instructions,
    ...(tools ? { tools } : {})
  })

  return {
    isAuthorized: true,
    response: result.toUIMessageStreamResponse()
  }
}

export const POST: RequestHandler = async (requestEvent) => {
  return apiRequestMiddleware(requestEvent, handleChat)
}
```

Note: with this approach, `resolveMessages.ts` (Task 3) is no longer used by the server route — it becomes a utility that could be used for non-streaming responses or testing. You may keep it or remove it. Do not delete it yet.

- [ ] **Step 3: Type-check**

```bash
npm run check
```

Expected: no TypeScript or Svelte errors. Fix any that appear before continuing.

- [ ] **Step 4: Run the test suite**

```bash
npm run test:unit -- --run
```

Expected: all existing tests plus the new ones pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/chat/+server.ts
git commit -m "feat: rewrite /api/chat to use AI SDK streamText — replaces vendor registry"
```

---

## Task 6: Rewrite `ChatState.svelte.ts` to use `@ai-sdk/svelte`

The `promptChat` method is replaced by the AI SDK `Chat` class. The `Chat` class manages message history, streaming, loading state, and errors. `ChatState` retains all the non-chat methods: `saveChatConfig`, `updateChatConfig`, `deleteChatConfig`, `changeChat`, `newChat`.

The key architectural shift: the AI SDK `Chat` instance holds conversation history in its own `messages` array (AI SDK `UIMessage[]` format). The existing `chat.history` (`ChatHistoryItem[]`) is still used for other purposes (UI rendering), but streaming goes through the `Chat` instance.

**Files:**
- Modify: `src/lib/components/Chat/ChatState.svelte.ts`

- [ ] **Step 1: Read the current file**

Open `src/lib/components/Chat/ChatState.svelte.ts`. Note:
- `promptChat` at line ~215 is what we're replacing
- `fileToBase64Url` and `fileToMessageContent` helpers are reused (file → base64 still needed)
- `saveChatConfig`, `updateChatConfig`, `deleteChatConfig` are kept unchanged
- The import of `postChatMessage` from `PostChatMessage.svelte` is removed

- [ ] **Step 2: Replace the file**

Replace the full content of `src/lib/components/Chat/ChatState.svelte.ts`:

```typescript
import { goto } from "$app/navigation"
import { Chat } from "@ai-sdk/svelte"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { Chat as HuginChat, ChatConfig, ChatHistory } from "$lib/types/chat"
import type { InputFile, InputImage } from "$lib/types/chat-item-content"

const fileToBase64Url = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Failed to convert file to Base64"))
    }
    reader.onerror = (error) => reject(error)
  })

const fileToMessageContent = async (
  file: File,
  supportedFileTypes: string[],
  supportedImageTypes: string[]
): Promise<InputFile | InputImage> => {
  let fileType: "image" | "file" | null = null
  if (supportedFileTypes.includes(file.type)) fileType = "file"
  else if (supportedImageTypes.includes(file.type)) fileType = "image"
  else throw new Error(`File type ${file.type} is not supported for upload`)

  const base64Data = await fileToBase64Url(file)

  if (fileType === "image") return { type: "input_image", imageUrl: base64Data }
  return { type: "input_file", fileName: file.name, fileUrl: base64Data }
}

const placeholderConfig: ChatConfig = {
  _id: "",
  name: "",
  description: "",
  vendorId: "MISTRAL",
  project: "",
  accessGroups: ["all"],
  type: "private",
  created: { at: "", by: { id: "", name: undefined } },
  updated: { at: "", by: { id: "", name: undefined } }
}

export class ChatState {
  public chatConfig: ChatConfig = $state(placeholderConfig)
  public initialConfig: ChatConfig = $state(placeholderConfig)
  public configEdited: boolean = $derived(JSON.stringify(this.chatConfig) !== JSON.stringify(this.initialConfig))
  public configMode: boolean = $state(false)
  public webSearchEnabled: boolean = $state(false)
  public user: AuthenticatedPrincipal
  public APP_CONFIG: AppConfig

  // AI SDK Chat instance — owns streaming, history, loading, error state
  public aiChat: Chat = $state(
    new Chat({
      api: "/api/chat",
      generateId: () => `msg_${Date.now()}`
    })
  )

  constructor(chat: HuginChat, user: AuthenticatedPrincipal, appConfig: AppConfig) {
    this.user = user
    this.APP_CONFIG = appConfig
    this.changeChat(chat)
  }

  public changeChat = (chat: HuginChat): void => {
    if (!chat) throw new Error("ChatState requires a Chat object")
    if (!chat.config.vendorAgent?.id && !chat.config.model) {
      throw new Error("Chat config must have either a vendorAgent id or a model defined")
    }
    this.chatConfig = chat.config
    this.initialConfig = JSON.parse(JSON.stringify(chat.config))
    this.webSearchEnabled = false

    // Reset AI SDK chat with the config for this bot
    this.aiChat = new Chat({
      api: "/api/chat",
      generateId: () => `msg_${Date.now()}`,
      body: {
        config: this.chatConfig,
        stream: true
      }
    })
  }

  public newChat = (): void => {
    this.aiChat = new Chat({
      api: "/api/chat",
      generateId: () => `msg_${Date.now()}`,
      body: {
        config: this.chatConfig,
        stream: true
      }
    })
  }

  public promptChat = async (inputText: string, inputFiles: FileList): Promise<void> => {
    const attachments: Array<{ name: string; contentType: string; url: string }> = []

    if (inputFiles && inputFiles.length > 0) {
      const vendor = this.APP_CONFIG.VENDORS[this.chatConfig.vendorId]
      if (!vendor) throw new Error(`Vendor not found: ${this.chatConfig.vendorId}`)
      const model = vendor.MODELS.find((m) => m.ID === this.chatConfig.model)
      if (!model) throw new Error(`Model not found: ${this.chatConfig.model}`)

      const supportedFileTypes = model.SUPPORTED_MESSAGE_FILE_MIME_TYPES.FILE
      const supportedImageTypes = model.SUPPORTED_MESSAGE_FILE_MIME_TYPES.IMAGE

      for (const file of Array.from(inputFiles)) {
        const content = await fileToMessageContent(file, supportedFileTypes, supportedImageTypes)
        const url = content.type === "input_file" ? content.fileUrl : content.imageUrl
        attachments.push({ name: file.name, contentType: file.type, url })
      }
    }

    const webSearchTools: ChatConfig["tools"] = this.webSearchEnabled
      ? [{ type: "web_search" }, ...(this.chatConfig.tools?.filter((t) => t.type !== "web_search") ?? [])]
      : this.chatConfig.tools?.filter((t) => t.type !== "web_search")

    // Update body with current config + web search state
    this.aiChat = new Chat({
      api: "/api/chat",
      generateId: () => `msg_${Date.now()}`,
      body: {
        config: { ...this.chatConfig, tools: webSearchTools },
        stream: true
      }
    })

    await this.aiChat.sendMessage({
      text: inputText,
      ...(attachments.length > 0 ? { experimental_attachments: attachments } : {})
    })
  }

  public saveChatConfig = async (): Promise<void> => {
    const result = await fetch("/api/chatconfigs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.chatConfig)
    })
    if (!result.ok) {
      const errorData = await result.json()
      throw new Error(`Failed to save chat config: ${result.status} - ${errorData.message ?? JSON.stringify(errorData)}`)
    }
    const savedConfig: ChatConfig = await result.json()
    goto(`/agents/${savedConfig._id}`)
  }

  public updateChatConfig = async (): Promise<void> => {
    const result = await fetch(`/api/chatconfigs/${this.chatConfig._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.chatConfig)
    })
    if (!result.ok) {
      const errorData = await result.json()
      throw new Error(`Failed to update chat config: ${result.status} - ${errorData.message ?? JSON.stringify(errorData)}`)
    }
    const updatedConfig: ChatConfig = await result.json()
    this.chatConfig = updatedConfig
    this.initialConfig = JSON.parse(JSON.stringify(updatedConfig))
    this.configMode = false
    goto(`/agents/${this.chatConfig._id}`)
  }

  public deleteChatConfig = async (): Promise<void> => {
    const confirmDelete = confirm("Er du sikker på at du vil slette denne assistenten? Dette kan ikke angres. 😬")
    if (!confirmDelete) return

    const result = await fetch(`/api/chatconfigs/${this.chatConfig._id}`, { method: "DELETE" })
    if (!result.ok) {
      const errorData = await result.json()
      throw new Error(`Failed to delete chat config: ${result.status} - ${errorData.message ?? JSON.stringify(errorData)}`)
    }
    goto("/agents")
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npm run check
```

Expected: no errors. Fix any before continuing. The most likely issue is that `Chat` from `@ai-sdk/svelte` expects different init options — check the installed version's types if needed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Chat/ChatState.svelte.ts
git commit -m "feat: rewrite ChatState to use AI SDK Chat class — replaces PostChatMessage SSE client"
```

---

## Task 7: Update `Chat.svelte` to consume AI SDK message format

The `Chat.svelte` component currently renders `chat.history` (our `ChatHistoryItem[]` format). With AI SDK, history lives in `chatState.aiChat.messages` (AI SDK `UIMessage[]` format). Each `UIMessage` has a `parts` array — `{ type: 'text', text: string }` for text content, and `{ type: 'source', ... }` for web search citations.

**Files:**
- Modify: `src/lib/components/Chat/Chat.svelte` (history rendering section)
- Read first: `src/lib/components/Chat/Chat.svelte` (full file)

- [ ] **Step 1: Read the full Chat.svelte file**

```bash
cat src/lib/components/Chat/Chat.svelte
```

Note which parts render history items and which reference `chatState.chat.history`.

- [ ] **Step 2: Update history rendering**

Find the section that maps over `chatState.chat.history` and replace it with a loop over `chatState.aiChat.messages`. The AI SDK message format:

```typescript
// UIMessage shape (from @ai-sdk/svelte)
{
  id: string,
  role: 'user' | 'assistant',
  parts: Array<
    | { type: 'text'; text: string }
    | { type: 'source'; source: { url: string; title?: string } }
    | { type: 'tool-invocation'; toolInvocation: { ... } }
  >
}
```

Replace the history rendering block in `Chat.svelte` with:

```svelte
{#each chatState.aiChat.messages as message (message.id)}
  {#if message.role === 'user'}
    <UserMessage>
      {#each message.parts as part}
        {#if part.type === 'text'}{part.text}{/if}
      {/each}
    </UserMessage>
  {:else if message.role === 'assistant'}
    <AssistantMessage isLoading={chatState.aiChat.status === 'streaming' && message === chatState.aiChat.messages.at(-1)}>
      {#each message.parts as part}
        {#if part.type === 'text'}<MarkdownRenderer text={part.text} />{/if}
        {#if part.type === 'source'}<UrlCitation url={part.source.url} title={part.source.title} />{/if}
      {/each}
    </AssistantMessage>
  {/if}
{/each}
```

Adapt the component names (`UserMessage`, `AssistantMessage`, `MarkdownRenderer`, `UrlCitation`) to match what already exists in the codebase — check `src/lib/components/Chat/` for existing sub-components before writing new ones.

- [ ] **Step 3: Update the submit handler**

Find where `chatState.promptChat(text, files)` is called from the input area. This stays the same — `promptChat` is still the public method. No change needed here.

- [ ] **Step 4: Update loading/status indicators**

Replace any reference to `chatState.isLoading` with `chatState.aiChat.status === 'streaming'` or `chatState.aiChat.status === 'submitted'`. The AI SDK status values are: `'ready'`, `'submitted'`, `'streaming'`, `'error'`.

- [ ] **Step 5: Type-check and visually inspect**

```bash
npm run check
npm run dev
```

Open the app in a browser. Send a test message to an OpenAI model and confirm:
- Message appears in the user bubble
- Streaming text appears progressively in the assistant bubble
- Loading state clears when done

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/Chat/Chat.svelte
git commit -m "feat: update Chat.svelte to render AI SDK UIMessage format"
```

---

## Task 8: Test file uploads end-to-end

**Files:**
- No new files — manual test only

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test image upload with OpenAI**

1. Select an OpenAI model (e.g. `gpt-4o`)
2. Attach a `.png` or `.jpg` image
3. Type "What do you see in this image?" and send
4. Confirm the response describes the image

- [ ] **Step 3: Test PDF upload with OpenAI**

1. Select an OpenAI model
2. Attach a small `.pdf` file
3. Type "Summarise this document" and send
4. Confirm the response references content from the PDF

- [ ] **Step 4: Test image upload with Mistral**

1. Select a Mistral model (e.g. `mistral-large-latest`)
2. Attach an image
3. Send a message about the image
4. Confirm response

- [ ] **Step 5: Commit any fixes found during testing**

If any issues appear during manual testing, fix them and commit with a descriptive message before continuing.

---

## Task 9: Test web search end-to-end

**Files:**
- No new files — manual test only

- [ ] **Step 1: Enable web search in the UI**

Toggle the web search option in the chat UI (the existing toggle in `Chat.svelte`).

- [ ] **Step 2: Send a question that requires current information**

Example: "What is the weather in Oslo today?" or "What happened in the news today?"

- [ ] **Step 3: Confirm the response includes sources**

The assistant response should include source citations rendered via the `UrlCitation` component (or however citations are rendered). Confirm they appear.

- [ ] **Step 4: Test with Mistral**

Repeat steps 2–3 with a Mistral model. `resolveTools` already uses `mistral.tools.webSearch()` for Mistral (defined in Task 4) — no code changes needed. If citations do not appear, check that the `source` parts are being rendered in `Chat.svelte` (Task 7, Step 2).

- [ ] **Step 5: Commit any fixes**

---

## Task 10: Run full test suite and clean up old vendor files

Once all manual tests pass, run the full test suite, then delete the old vendor files.

**Files:**
- Delete: all files listed in the "Deleted files" section of the File Map above

- [ ] **Step 1: Run the full test suite**

```bash
npm run test
```

Expected: all checks pass (tsc + biome + build + unit tests). Fix any failures before continuing.

- [ ] **Step 2: Delete old vendor files**

```bash
git rm src/lib/server/ai-vendors.ts
git rm src/lib/types/AIVendor.ts
git rm src/lib/types/streaming.ts
git rm src/lib/streaming.ts
git rm src/lib/components/Chat/PostChatMessage.svelte.ts
git rm src/lib/server/openai/openai-vendor.ts
git rm src/lib/server/openai/openai-mapping.ts
git rm src/lib/server/openai/openai-stream.ts
git rm src/lib/server/openai/openai-files.ts
git rm src/lib/server/mistral/mistral-vendor.ts
git rm src/lib/server/mistral/mistral-mapping.ts
git rm src/lib/server/mistral/mistral-stream.ts
git rm src/lib/server/mistral/mistral-files.ts
```

- [ ] **Step 3: Type-check after deletion**

```bash
npm run check
```

Fix any import errors that appear — these will be places where the deleted files were still imported. Common locations: `src/routes/api/chat/+server.ts` (should already be updated), any tests that imported old vendor files.

- [ ] **Step 4: Run full test suite again**

```bash
npm run test
```

Expected: all checks still pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: delete old vendor abstraction layer — replaced by AI SDK"
```

---

## Task 11: Final smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev -- --open
```

- [ ] **Step 2: Smoke test checklist**

- [ ] OpenAI text streaming works (stream progressively appears)
- [ ] Mistral text streaming works
- [ ] OpenAI file upload works (image + PDF)
- [ ] Mistral file upload works (image)
- [ ] Web search works (OpenAI)
- [ ] Web search citations appear in the UI
- [ ] Error state: disconnect network mid-stream, confirm UI shows error and recovers
- [ ] `npm run test` passes clean

- [ ] **Step 3: Tag the milestone**

```bash
git tag ai-sdk-prototype-v1
```
