# Phase 7: Transcription Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move inline Zod schemas out of the transcription route file into the validation layer, and replace weak `startsWith` SSRF guards with `URL`-based origin checks — with no breaking changes to any external API contracts.

**Architecture:** Two independent slices. Slice 1: extract `CreateJobSchema`, `UpdateJobSchema`, `DeleteJobSchema` from `src/routes/api/transcription/+server.ts` into `src/lib/validation/transcription.ts`, consistent with how `ChatConfigSchema` is handled. Slice 2: replace every `startsWith(copypartyBase)` guard with a helper `isTrustedCopypartyUrl(url, base)` that uses `URL` origin comparison — the same guard logic, just robust to trailing slashes and URL variants. No behavior changes beyond the SSRF fix.

**Tech Stack:** TypeScript (strict), SvelteKit, Zod (already used for `TranscriptionCallbackSchema`), Vitest (server test project at `tests/server/`).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/validation/transcription.ts` | Zod schemas for transcription route request bodies |
| Modify | `src/routes/api/transcription/+server.ts` | Import schemas from validation layer instead of defining inline |
| Create | `src/lib/server/transcription/copyparty-url.ts` | `isTrustedCopypartyUrl(url, base): boolean` helper |
| Modify | `src/routes/api/transcription/+server.ts` | Replace `startsWith` guards with `isTrustedCopypartyUrl` |
| Modify | `src/routes/api/transcription/[id]/download/+server.ts` | Replace `startsWith` guard with `isTrustedCopypartyUrl` |
| Create | `tests/server/validation/transcription.test.ts` | Tests for the three request body schemas |
| Create | `tests/server/transcription/copyparty-url.test.ts` | Tests for `isTrustedCopypartyUrl` |

---

### Task 1: Extract transcription request body schemas to validation layer

**Files:**
- Create: `src/lib/validation/transcription.ts`
- Modify: `src/routes/api/transcription/+server.ts`
- Create: `tests/server/validation/transcription.test.ts`

**Context — current state:**
`src/routes/api/transcription/+server.ts` lines 10–24 define three inline Zod schemas:
```typescript
const CreateJobSchema = z.object({ fileName: z.string().min(1) })
const UpdateJobSchema = z.object({ id: z.string().min(1), status: z.enum(["processing"]) })
const DeleteJobSchema = z.object({
    id: z.string().min(1),
    fileName: z.string().min(1),
    audioUrl: z.string().url().nullable().optional(),
    docxUrl: z.string().url().nullable().optional()
})
```
These must move to `src/lib/validation/transcription.ts` and be imported back. The route logic must not change at all.

- [ ] **Step 1.1: Write the failing tests**

Create `tests/server/validation/transcription.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { CreateJobSchema, DeleteJobSchema, UpdateJobSchema } from "$lib/validation/transcription"

describe("CreateJobSchema", () => {
	it("accepts a valid fileName", () => {
		const result = CreateJobSchema.safeParse({ fileName: "audio.mp3" })
		expect(result.success).toBe(true)
	})

	it("rejects empty fileName", () => {
		const result = CreateJobSchema.safeParse({ fileName: "" })
		expect(result.success).toBe(false)
	})

	it("rejects missing fileName", () => {
		const result = CreateJobSchema.safeParse({})
		expect(result.success).toBe(false)
	})
})

describe("UpdateJobSchema", () => {
	it("accepts valid id and processing status", () => {
		const result = UpdateJobSchema.safeParse({ id: "job-1", status: "processing" })
		expect(result.success).toBe(true)
	})

	it("rejects unknown status", () => {
		const result = UpdateJobSchema.safeParse({ id: "job-1", status: "completed" })
		expect(result.success).toBe(false)
	})

	it("rejects missing id", () => {
		const result = UpdateJobSchema.safeParse({ status: "processing" })
		expect(result.success).toBe(false)
	})
})

describe("DeleteJobSchema", () => {
	it("accepts minimal valid body", () => {
		const result = DeleteJobSchema.safeParse({ id: "job-1", fileName: "audio.mp3" })
		expect(result.success).toBe(true)
	})

	it("accepts body with valid audioUrl and docxUrl", () => {
		const result = DeleteJobSchema.safeParse({
			id: "job-1",
			fileName: "audio.mp3",
			audioUrl: "https://copyparty.example.com/audio.mp3",
			docxUrl: "https://copyparty.example.com/result.docx"
		})
		expect(result.success).toBe(true)
	})

	it("accepts null audioUrl and docxUrl", () => {
		const result = DeleteJobSchema.safeParse({ id: "job-1", fileName: "audio.mp3", audioUrl: null, docxUrl: null })
		expect(result.success).toBe(true)
	})

	it("rejects non-URL audioUrl", () => {
		const result = DeleteJobSchema.safeParse({ id: "job-1", fileName: "audio.mp3", audioUrl: "not-a-url" })
		expect(result.success).toBe(false)
	})

	it("rejects empty id", () => {
		const result = DeleteJobSchema.safeParse({ id: "", fileName: "audio.mp3" })
		expect(result.success).toBe(false)
	})
})
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
npm run test:unit -- --reporter=verbose tests/server/validation/transcription.test.ts
```

Expected: FAIL — `Cannot find module '$lib/validation/transcription'`

- [ ] **Step 1.3: Create `src/lib/validation/transcription.ts`**

```typescript
import z from "zod"

export const CreateJobSchema = z.object({
	fileName: z.string().min(1)
})

export const UpdateJobSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["processing"])
})

export const DeleteJobSchema = z.object({
	id: z.string().min(1),
	fileName: z.string().min(1),
	audioUrl: z.string().url().nullable().optional(),
	docxUrl: z.string().url().nullable().optional()
})
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
npm run test:unit -- --reporter=verbose tests/server/validation/transcription.test.ts
```

Expected: 8 tests PASS.

- [ ] **Step 1.5: Update `src/routes/api/transcription/+server.ts` to import from the validation layer**

Remove the three inline schema definitions (lines 10–24) and replace the `import z from "zod"` line with an import from the validation module.

The top of the file should change from:
```typescript
import { json, type RequestHandler } from "@sveltejs/kit"
import z from "zod"
import { env } from "$env/dynamic/private"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { createPendingJob, getJobById, listJobsForUser, markJobProcessing, removeJob } from "$lib/server/transcription/job-store"
import { triggerTranscription } from "$lib/server/transcription/tale-til-notat"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const CreateJobSchema = z.object({
	fileName: z.string().min(1)
})

const UpdateJobSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["processing"])
})

const DeleteJobSchema = z.object({
	id: z.string().min(1),
	fileName: z.string().min(1),
	audioUrl: z.string().url().nullable().optional(),
	docxUrl: z.string().url().nullable().optional()
})
```

To:
```typescript
import { json, type RequestHandler } from "@sveltejs/kit"
import { env } from "$env/dynamic/private"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { createPendingJob, getJobById, listJobsForUser, markJobProcessing, removeJob } from "$lib/server/transcription/job-store"
import { triggerTranscription } from "$lib/server/transcription/tale-til-notat"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { CreateJobSchema, DeleteJobSchema, UpdateJobSchema } from "$lib/validation/transcription"
```

The rest of the file is unchanged — `CreateJobSchema`, `UpdateJobSchema`, `DeleteJobSchema` are still referenced by the same names so no further edits needed.

- [ ] **Step 1.6: Run check and full test suite**

```bash
npm run check && npm run lint && npm run test
```

Expected: 0 errors, 0 lint issues, all tests pass.

---

### Task 2: Replace `startsWith` SSRF guards with URL-based origin checks

**Files:**
- Create: `src/lib/server/transcription/copyparty-url.ts`
- Modify: `src/routes/api/transcription/+server.ts`
- Modify: `src/routes/api/transcription/[id]/download/+server.ts`
- Create: `tests/server/transcription/copyparty-url.test.ts`

**Context — why `startsWith` is weak:**
`"https://copyparty.example.com".startsWith("https://copyparty.example.com")` is true, but so is `"https://copyparty.example.com.evil.com/..."` if the base lacks a trailing slash, or an attacker can craft a URL like `https://copyparty.example.comX` that starts with the base. Using `new URL()` and comparing `.origin` is exact and normalizes scheme, host, and port.

**Current `startsWith` guard locations:**
1. `src/routes/api/transcription/+server.ts` line 91: `clientAudioUrl?.startsWith(copypartyBase)`
2. `src/routes/api/transcription/+server.ts` line 103: `effectiveDocxUrl?.startsWith(copypartyBase)`
3. `src/routes/api/transcription/[id]/download/+server.ts` line 29: `!job.result.docx_url.startsWith(copypartyBase)`

All three must be replaced with `isTrustedCopypartyUrl(url, base)`.

- [ ] **Step 2.1: Write the failing tests**

Create `tests/server/transcription/copyparty-url.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { isTrustedCopypartyUrl } from "$lib/server/transcription/copyparty-url"

const BASE = "https://copyparty.example.com"

describe("isTrustedCopypartyUrl", () => {
	it("accepts a URL on the same origin", () => {
		expect(isTrustedCopypartyUrl("https://copyparty.example.com/user/file.mp3", BASE)).toBe(true)
	})

	it("accepts a URL when base has a trailing slash", () => {
		expect(isTrustedCopypartyUrl("https://copyparty.example.com/user/file.mp3", "https://copyparty.example.com/")).toBe(true)
	})

	it("rejects a URL on a different host", () => {
		expect(isTrustedCopypartyUrl("https://evil.example.com/file.mp3", BASE)).toBe(false)
	})

	it("rejects a URL that starts with the base string but has a different host", () => {
		expect(isTrustedCopypartyUrl("https://copyparty.example.com.evil.com/file.mp3", BASE)).toBe(false)
	})

	it("rejects a URL with a different scheme", () => {
		expect(isTrustedCopypartyUrl("http://copyparty.example.com/file.mp3", BASE)).toBe(false)
	})

	it("rejects a URL with a different port", () => {
		expect(isTrustedCopypartyUrl("https://copyparty.example.com:8080/file.mp3", BASE)).toBe(false)
	})

	it("returns false for a malformed URL", () => {
		expect(isTrustedCopypartyUrl("not-a-url", BASE)).toBe(false)
	})

	it("returns false for a malformed base", () => {
		expect(isTrustedCopypartyUrl("https://copyparty.example.com/file.mp3", "not-a-base")).toBe(false)
	})

	it("returns false when url is empty string", () => {
		expect(isTrustedCopypartyUrl("", BASE)).toBe(false)
	})
})
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
npm run test:unit -- --reporter=verbose tests/server/transcription/copyparty-url.test.ts
```

Expected: FAIL — `Cannot find module '$lib/server/transcription/copyparty-url'`

- [ ] **Step 2.3: Create `src/lib/server/transcription/copyparty-url.ts`**

```typescript
export const isTrustedCopypartyUrl = (url: string, base: string): boolean => {
	try {
		const urlOrigin = new URL(url).origin
		const baseOrigin = new URL(base).origin
		return urlOrigin === baseOrigin
	} catch {
		return false
	}
}
```

- [ ] **Step 2.4: Run tests to confirm they pass**

```bash
npm run test:unit -- --reporter=verbose tests/server/transcription/copyparty-url.test.ts
```

Expected: 9 tests PASS.

- [ ] **Step 2.5: Update `src/routes/api/transcription/+server.ts`**

Add the import at the top (after the existing imports):
```typescript
import { isTrustedCopypartyUrl } from "$lib/server/transcription/copyparty-url"
```

In the `deleteJob` handler, replace line 91:
```typescript
// Before
const effectiveAudioUrl = job?.audioUrl ?? (clientAudioUrl?.startsWith(copypartyBase) ? clientAudioUrl : null)
// After
const effectiveAudioUrl = job?.audioUrl ?? (clientAudioUrl && isTrustedCopypartyUrl(clientAudioUrl, copypartyBase) ? clientAudioUrl : null)
```

And replace line 103:
```typescript
// Before
if (effectiveDocxUrl?.startsWith(copypartyBase)) {
// After
if (effectiveDocxUrl && isTrustedCopypartyUrl(effectiveDocxUrl, copypartyBase)) {
```

- [ ] **Step 2.6: Update `src/routes/api/transcription/[id]/download/+server.ts`**

Add the import at the top:
```typescript
import { isTrustedCopypartyUrl } from "$lib/server/transcription/copyparty-url"
```

Replace line 29:
```typescript
// Before
if (copypartyBase && !job.result.docx_url.startsWith(copypartyBase)) {
// After
if (copypartyBase && !isTrustedCopypartyUrl(job.result.docx_url, copypartyBase)) {
```

- [ ] **Step 2.7: Run check and full test suite**

```bash
npm run check && npm run lint && npm run test
```

Expected: 0 errors, 0 lint issues, all tests pass.

---

### Task 3: Update REFACTOR_PLAN.md

**Files:**
- Modify: `REFACTOR_PLAN.md`

- [ ] **Step 3.1: Add dated progress entry**

Append before "Definition of done":

```markdown
### 2026-05-21 — Phase 7: Transcription hardening (partial)

Completed:

- Extracted `CreateJobSchema`, `UpdateJobSchema`, `DeleteJobSchema` from `src/routes/api/transcription/+server.ts` into `src/lib/validation/transcription.ts`, consistent with the validation layer pattern used for chat config.
- Added 8 unit tests for the three schemas covering valid inputs, empty strings, invalid URLs, and unknown enum values.
- Added `isTrustedCopypartyUrl(url, base)` helper in `src/lib/server/transcription/copyparty-url.ts` that uses `URL` origin comparison instead of `startsWith`.
- Replaced all three `startsWith(copypartyBase)` SSRF guards with `isTrustedCopypartyUrl`.
- Added 9 unit tests covering same-origin acceptance, trailing-slash normalization, subdomain attacks, scheme mismatch, port mismatch, malformed URLs, and empty strings.
- No breaking changes to any external API contracts.

Deferred:
- Callback secret in query string (requires change to `tale-til-notat` service).
- In-memory job store (requires Mongo-backed `ITranscriptionJobStore` — deferred until persistence is needed).

Verified:

- `npm run check` reports 0 errors and 0 warnings.
- `npm run lint` reports 0 issues.
- `npm run test` passes.
```

---

## Self-Review

**Spec coverage:**
- ✅ Move inline Zod schemas to `src/lib/validation/transcription.ts` → Task 1
- ✅ Tests for the three schemas → Task 1 step 1.1 (8 tests)
- ✅ Replace `startsWith` SSRF guards with URL origin checks → Task 2
- ✅ Tests for `isTrustedCopypartyUrl` → Task 2 step 2.1 (9 tests)
- ✅ No breaking changes — route handler logic unchanged, only imports moved and guard calls replaced → verified in steps 1.5 and 2.5–2.6
- ✅ Update REFACTOR_PLAN.md → Task 3

**Placeholder scan:** None found. All code is complete.

**Type consistency:**
- `CreateJobSchema`, `UpdateJobSchema`, `DeleteJobSchema` — named identically in test imports, validation file, and route imports
- `isTrustedCopypartyUrl(url: string, base: string): boolean` — consistent across test, implementation, and all three call sites
