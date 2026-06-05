# OpenAI File Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload files to the OpenAI Files API before sending a chat request (instead of inlining base64), so large files are handled efficiently, and configure them to auto-expire after 24 hours.

**Architecture:** Mirror the existing Mistral pattern — a dedicated `openai-files.ts` module exports `uploadOpenAIDataUrlAndGetFileId(openai, dataUrl, fileName): Promise<string>`, which uploads a file with a 24-hour `expires_after` policy and returns the file ID. The OpenAI mapping layer (`openai-mapping.ts`) calls this for `input_file` content items that carry a `data:` URL, replacing the current `file_data` (inline base64) approach with `file_id`. Non-data-URL values (already a URL or file ID) are passed through unchanged using `file_url`.

**Tech Stack:** OpenAI SDK v6 (`openai` package) — `openai.files.create()` with `expires_after: { anchor: "created_at", seconds: 86400 }`, `purpose: "user_data"`. Vitest for tests.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/lib/server/openai/openai-files.ts` | Upload data URL to Files API, return `file_id` |
| **Modify** | `src/lib/server/openai/openai-mapping.ts` | Call `uploadOpenAIDataUrlAndGetFileId` for `input_file` data URLs, use `file_id` instead of `file_data` |
| **Create** | `tests/server/openai/openai-files.test.ts` | Unit tests for `dataUrlToBlob` (reused) and `uploadOpenAIDataUrlAndGetFileId` |

---

## Task 1: Create `openai-files.ts`

**Files:**
- Create: `src/lib/server/openai/openai-files.ts`
- Create: `tests/server/openai/openai-files.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/server/openai/openai-files.test.ts`:

```typescript
import type OpenAI from "openai"
import { describe, expect, it, vi } from "vitest"
import { dataUrlToBlob, OPENAI_UPLOADED_FILE_EXPIRY_SECONDS, uploadOpenAIDataUrlAndGetFileId } from "$lib/server/openai/openai-files"

describe("dataUrlToBlob", () => {
	it("converts base64 data URLs to typed blobs", async () => {
		const blob = dataUrlToBlob("data:text/plain;base64,SGVsbG8=")

		expect(blob.type).toBe("text/plain")
		expect(await blob.text()).toBe("Hello")
	})

	it("rejects invalid data URLs", () => {
		expect(() => dataUrlToBlob("https://example.com/file.pdf")).toThrow("Invalid base64 data URL")
	})
})

describe("uploadOpenAIDataUrlAndGetFileId", () => {
	it("uploads file with 24-hour expiry and returns file_id", async () => {
		const create = vi.fn().mockResolvedValue({ id: "file-abc123" })
		const openai = { files: { create } } as unknown as OpenAI

		const fileId = await uploadOpenAIDataUrlAndGetFileId(openai, "data:text/plain;base64,SGVsbG8=", "hello.txt")

		expect(fileId).toBe("file-abc123")
		expect(create).toHaveBeenCalledWith({
			file: expect.any(File),
			purpose: "user_data",
			expires_after: { anchor: "created_at", seconds: OPENAI_UPLOADED_FILE_EXPIRY_SECONDS }
		})
	})

	it("uses the provided fileName for the uploaded File object", async () => {
		const create = vi.fn().mockResolvedValue({ id: "file-xyz" })
		const openai = { files: { create } } as unknown as OpenAI

		await uploadOpenAIDataUrlAndGetFileId(openai, "data:application/pdf;base64,SGVsbG8=", "document.pdf")

		const uploadedFile: File = create.mock.calls[0][0].file
		expect(uploadedFile.name).toBe("document.pdf")
		expect(uploadedFile.type).toBe("application/pdf")
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- --reporter=verbose tests/server/openai/openai-files.test.ts
```

Expected: FAIL — `Cannot find module '$lib/server/openai/openai-files'`

- [ ] **Step 3: Implement `openai-files.ts`**

Create `src/lib/server/openai/openai-files.ts`:

```typescript
import type OpenAI from "openai"

export const OPENAI_UPLOADED_FILE_EXPIRY_SECONDS = 86400 // 24 hours

export const dataUrlToBlob = (dataUrl: string): Blob => {
	const match = dataUrl.match(/^data:([^;,]+);base64,(.*)$/)
	if (!match?.[1] || !match[2]) {
		throw new Error("Invalid base64 data URL")
	}
	const bytes = Buffer.from(match[2], "base64")
	return new Blob([bytes], { type: match[1] })
}

export const uploadOpenAIDataUrlAndGetFileId = async (openai: OpenAI, dataUrl: string, fileName: string): Promise<string> => {
	const blob = dataUrlToBlob(dataUrl)
	const file = new File([blob], fileName, { type: blob.type })
	const uploaded = await openai.files.create({
		file,
		purpose: "user_data",
		expires_after: { anchor: "created_at", seconds: OPENAI_UPLOADED_FILE_EXPIRY_SECONDS }
	})
	return uploaded.id
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- --reporter=verbose tests/server/openai/openai-files.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/openai/openai-files.ts tests/server/openai/openai-files.test.ts
git commit -m "feat: add OpenAI file upload helper with 24-hour expiry"
```

---

## Task 2: Wire file upload into the OpenAI mapping layer

**Files:**
- Modify: `src/lib/server/openai/openai-mapping.ts` — make `chatInputToOpenAIInput` async, call `uploadOpenAIDataUrlAndGetFileId` for `input_file` data URLs
- Modify: `src/lib/server/openai/openai-vendor.ts` — await the now-async mapping

> **Context:** Currently `chatInputToOpenAIInput` is synchronous and for `input_file` it passes `file_data: contentItem.fileUrl` (inline base64). We need to upload data URLs first and pass `file_id` instead. Non-data-URL values are passed as `file_url` (the existing fallback used by mistral is not needed here — OpenAI supports `file_url` directly for http/https URLs).

- [ ] **Step 1: Write the failing test for the mapping layer**

Add to `tests/server/openai/openai-files.test.ts` (append a new `describe` block):

```typescript
import type { ResponseInputItem } from "openai/resources/responses/responses.mjs"
import { chatInputToOpenAIInput } from "$lib/server/openai/openai-mapping"
import type { ChatInputMessage } from "$lib/types/chat-item"

describe("chatInputToOpenAIInput — input_file with data URL", () => {
	it("uploads data URL and returns file_id input", async () => {
		const create = vi.fn().mockResolvedValue({ id: "file-uploaded-123" })
		const openai = { files: { create } } as unknown as OpenAI

		const inputItem: ChatInputMessage = {
			type: "message.input",
			role: "user",
			content: [
				{ type: "input_file", fileName: "report.pdf", fileUrl: "data:application/pdf;base64,SGVsbG8=" }
			]
		}

		const result = await chatInputToOpenAIInput(openai, inputItem) as ResponseInputItem.Message
		const filePart = result.content[0] as { type: string; file_id: string; filename: string }

		expect(create).toHaveBeenCalledOnce()
		expect(filePart.type).toBe("input_file")
		expect(filePart.file_id).toBe("file-uploaded-123")
		expect(filePart.filename).toBe("report.pdf")
	})

	it("passes http/https URLs through as file_url without uploading", async () => {
		const create = vi.fn()
		const openai = { files: { create } } as unknown as OpenAI

		const inputItem: ChatInputMessage = {
			type: "message.input",
			role: "user",
			content: [
				{ type: "input_file", fileName: "remote.pdf", fileUrl: "https://example.com/doc.pdf" }
			]
		}

		const result = await chatInputToOpenAIInput(openai, inputItem) as ResponseInputItem.Message
		const filePart = result.content[0] as { type: string; file_url: string; filename: string }

		expect(create).not.toHaveBeenCalled()
		expect(filePart.type).toBe("input_file")
		expect(filePart.file_url).toBe("https://example.com/doc.pdf")
		expect(filePart.filename).toBe("remote.pdf")
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- --reporter=verbose tests/server/openai/openai-files.test.ts
```

Expected: FAIL — `chatInputToOpenAIInput` doesn't accept an `openai` argument yet.

- [ ] **Step 3: Update `openai-mapping.ts`**

Make `chatInputMessageToOpenAIInputMessage` and `chatInputToOpenAIInput` async, add `openai: OpenAI` parameter, and call `uploadOpenAIDataUrlAndGetFileId` for data URLs.

The full updated file `src/lib/server/openai/openai-mapping.ts`:

```typescript
import { logger } from "@vestfoldfylke/loglady"
import OpenAI from "openai"
import type { Response } from "openai/resources/responses/responses.js"
import type { ResponseInputItem, ResponseOutputItem, ResponseOutputMessage } from "openai/resources/responses/responses.mjs"
import type { ChatConfig, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessage, ChatOutputItem, ChatOutputMessage } from "$lib/types/chat-item"
import { uploadOpenAIDataUrlAndGetFileId } from "./openai-files"

const chatInputMessageToOpenAIInputMessage = async (openai: OpenAI, inputItem: ChatInputMessage): Promise<ResponseInputItem.Message> => {
	const openAIItem: ResponseInputItem.Message = {
		type: "message",
		role: inputItem.role,
		content: []
	}
	for (const contentItem of inputItem.content) {
		switch (contentItem.type) {
			case "input_text": {
				openAIItem.content.push(contentItem)
				break
			}
			case "input_file": {
				if (contentItem.fileUrl.startsWith("data:")) {
					const fileId = await uploadOpenAIDataUrlAndGetFileId(openai, contentItem.fileUrl, contentItem.fileName)
					openAIItem.content.push({
						type: "input_file",
						file_id: fileId,
						filename: contentItem.fileName
					})
				} else {
					openAIItem.content.push({
						type: "input_file",
						file_url: contentItem.fileUrl,
						filename: contentItem.fileName
					})
				}
				break
			}
			case "input_image": {
				openAIItem.content.push({
					type: "input_image",
					image_url: contentItem.imageUrl,
					detail: "auto"
				})
				break
			}
		}
	}
	return openAIItem
}

const chatOutputMessageToOpenAIOutputMessage = (outputItem: ChatOutputMessage): ResponseOutputMessage => {
	const openAIItem: ResponseOutputMessage = {
		id: outputItem.id,
		status: "completed",
		type: "message",
		role: outputItem.role,
		content: []
	}
	for (const contentItem of outputItem.content) {
		switch (contentItem.type) {
			case "output_text": {
				openAIItem.content.push({
					type: "output_text",
					annotations: [],
					text: contentItem.text
				})
				break
			}
			case "output_refusal": {
				openAIItem.content.push({
					type: "refusal",
					refusal: contentItem.reason
				})
				break
			}
		}
	}
	return openAIItem
}

export const chatInputToOpenAIInput = async (openai: OpenAI, inputItem: ChatInputItem): Promise<ResponseInputItem> => {
	switch (inputItem.type) {
		case "message.input": {
			return chatInputMessageToOpenAIInputMessage(openai, inputItem)
		}
		case "message.output": {
			return chatOutputMessageToOpenAIOutputMessage(inputItem)
		}
		default: {
			throw new Error(`Unsupported ChatInputItem: ${JSON.stringify(inputItem)}`)
		}
	}
}

const openAIChatOutputMessageToChatOutputMessage = (outputItem: ResponseOutputMessage): ChatOutputMessage => {
	const chatOutputItem: ChatOutputMessage = {
		id: outputItem.id,
		type: "message.output",
		role: "assistant",
		content: []
	}
	for (const contentItem of outputItem.content) {
		switch (contentItem.type) {
			case "output_text": {
				const urlCitations = contentItem.annotations.filter((a) => a.type === "url_citation")
				chatOutputItem.content.push({
					type: "output_text",
					text: contentItem.text,
					...(urlCitations.length > 0 && {
						annotations: urlCitations.map((a) => ({
							type: "url_citation" as const,
							url: a.url,
							title: a.title,
							startIndex: a.start_index,
							endIndex: a.end_index
						}))
					})
				})
				break
			}
			case "refusal": {
				chatOutputItem.content.push({
					type: "output_refusal",
					reason: contentItem.refusal
				})
				break
			}
			default: {
				logger.warn("Unsupported OpenAI OutputItem Content: {@contentItem}", contentItem)
			}
		}
	}
	return chatOutputItem
}

const openAIOutputToChatOutput = (outputItem: ResponseOutputItem): ChatOutputItem => {
	switch (outputItem.type) {
		case "message": {
			return openAIChatOutputMessageToChatOutputMessage(outputItem)
		}
		default: {
			logger.warn("Unsupported OpenAI OutputItem: {@outputItem}", outputItem)
			return {
				id: `unsupported_output_${Date.now()}`,
				type: "message.output",
				role: "assistant",
				content: [
					{
						type: "output_text",
						text: `Unsupported output item from OpenAI: ${outputItem.type}`
					}
				]
			}
		}
	}
}

export const openAiResponseToChatResponseObject = (config: ChatConfig, response: Response): ChatResponseObject => {
	return {
		id: response.id,
		config,
		type: "chat_response",
		createdAt: new Date(response.created_at).toISOString(),
		outputs: response.output.map(openAIOutputToChatOutput),
		status: response.status || "incomplete",
		usage: {
			inputTokens: response.usage?.input_tokens || 0,
			outputTokens: response.usage?.output_tokens || 0,
			totalTokens: response.usage?.total_tokens || 0
		}
	}
}
```

- [ ] **Step 4: Update `openai-vendor.ts` to pass `openai` to mapping**

The `openAiRequest` function currently maps inputs synchronously with `chatRequest.inputs.map(chatInputToOpenAIInput)`. It must now be async and pass the `openai` client.

Update `src/lib/server/openai/openai-vendor.ts` — change `openAiRequest` to accept `openai: OpenAI` and make inputs async:

```typescript
import { logger } from "@vestfoldfylke/loglady"
import OpenAI from "openai"
import type { ResponseCreateParamsBase } from "openai/resources/responses/responses.mjs"
import { env } from "$env/dynamic/private"
import { externalErrorToHTTPError } from "$lib/server/middleware/external-error"
import type { IAIVendor } from "$lib/types/AIVendor"
import type { ChatRequest, ChatResponseObject, ChatResponseStream } from "$lib/types/chat"
import { APP_CONFIG } from "../app-config/app-config"
import { chatInputToOpenAIInput, openAiResponseToChatResponseObject } from "./openai-mapping"
import { handleOpenAIResponseStream } from "./openai-stream"

logger.logConfig({ prefix: "hugin - openai-vendor" })

const OPEN_AI_SUPPORTED_MODELS = APP_CONFIG.VENDORS.OPENAI.MODELS.map((model) => model.ID)

const openAiRequest = async (openai: OpenAI, chatRequest: ChatRequest): Promise<ResponseCreateParamsBase> => {
	const baseConfig: ResponseCreateParamsBase = {
		input: await Promise.all(chatRequest.inputs.map((input) => chatInputToOpenAIInput(openai, input))),
		store: false
	}

	const tools = chatRequest.config.tools?.map((tool) => {
		if (tool.type === "web_search") {
			return { type: "web_search_preview" as const }
		}
		return tool
	})

	if (chatRequest.config.vendorAgent) {
		if (!chatRequest.config.vendorAgent.id) {
			throw new Error("vendorAgent with valid id is required for predefined agent chat config")
		}
		return {
			prompt: {
				id: chatRequest.config.vendorAgent.id
			},
			...baseConfig
		}
	}
	if (!chatRequest.config.model) {
		throw new Error("Model is required for manual chat config")
	}
	if (!OPEN_AI_SUPPORTED_MODELS.includes(chatRequest.config.model)) {
		throw new Error(`Model ${chatRequest.config.model} is not supported by OpenAI vendor`)
	}
	return {
		...baseConfig,
		model: chatRequest.config.model,
		instructions: chatRequest.config.instructions || "",
		...(tools ? { tools } : {})
	}
}

const getApiKeyForProject = (project: string): string => {
	const PROJECT_API_KEY = env[`OPENAI_API_KEY_PROJECT_${project}`]
	if (!PROJECT_API_KEY) {
		throw new Error(`No OpenAI API key found for project ${project}`)
	}
	return PROJECT_API_KEY
}

export class OpenAIVendor implements IAIVendor {
	public async createChatResponse(chatRequest: ChatRequest): Promise<ChatResponseObject> {
		const PROJECT_API_KEY = getApiKeyForProject(chatRequest.config.project)
		const openai = new OpenAI({
			apiKey: PROJECT_API_KEY
		})
		logger.info("OpenAI non-streaming request — model: {model}", chatRequest.config.model ?? chatRequest.config.vendorAgent?.id ?? "unknown")
		try {
			const response = await openai.responses.create({
				...(await openAiRequest(openai, chatRequest)),
				stream: false
			})
			return openAiResponseToChatResponseObject(chatRequest.config, response)
		} catch (error) {
			throw externalErrorToHTTPError(error, "OpenAI") ?? error
		}
	}

	public async createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream> {
		const PROJECT_API_KEY = getApiKeyForProject(chatRequest.config.project)
		const openai = new OpenAI({
			apiKey: PROJECT_API_KEY
		})
		logger.info("OpenAI streaming request — model: {model}", chatRequest.config.model ?? chatRequest.config.vendorAgent?.id ?? "unknown")
		try {
			const responseStream = await openai.responses.create({
				...(await openAiRequest(openai, chatRequest)),
				stream: true
			})
			return handleOpenAIResponseStream(chatRequest, responseStream)
		} catch (error) {
			throw externalErrorToHTTPError(error, "OpenAI") ?? error
		}
	}
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:unit -- --reporter=verbose tests/server/openai/openai-files.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 6: Run the full test suite**

```bash
npm run test
```

Expected: All tests PASS, TypeScript clean, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/openai/openai-mapping.ts src/lib/server/openai/openai-vendor.ts tests/server/openai/openai-files.test.ts
git commit -m "feat: wire OpenAI file upload into mapping layer — use file_id for data URLs"
```

---

## Self-Review

**Spec coverage:**
- ✅ Files uploaded via Files API (not inlined as base64)
- ✅ 24-hour expiry via `expires_after: { anchor: "created_at", seconds: 86400 }`
- ✅ Pattern matches Mistral implementation (`mistral-files.ts` → `openai-files.ts`)
- ✅ Non-data-URL values passed through as `file_url` (no unnecessary upload)
- ✅ Tests cover upload, file naming, and pass-through cases
- ✅ `openai` instance passed down from vendor to mapping (mirrors Mistral pattern)

**Placeholder scan:** No TBDs, no "add error handling later", all code blocks complete.

**Type consistency:** `chatInputToOpenAIInput(openai, inputItem)` — same signature in mapping definition, vendor call site, and test import. `OPENAI_UPLOADED_FILE_EXPIRY_SECONDS` exported from `openai-files.ts` and referenced in tests.
