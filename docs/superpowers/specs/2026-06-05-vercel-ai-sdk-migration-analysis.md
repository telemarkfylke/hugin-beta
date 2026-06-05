# Vercel AI SDK Migration Analysis

**Date:** 2026-06-05  
**Author:** Tom Jarle Christiansen (fuzzbin) + Claude Code  
**Status:** Exploratory — decision not yet made  
**Branch context:** `byob-agentrefaktorert-fuzzbin`

---

## Executive Summary

Hugin Beta currently owns a full bespoke vendor abstraction stack: a `IAIVendor` interface, per-vendor mapping files, per-vendor stream handlers, a hand-rolled SSE protocol (`MuginSse`), and a custom SSE parser and streaming client. This gives full control but creates significant maintenance overhead: every new provider requires ~4 new files, every provider SDK update may break the mapping layer, and the streaming plumbing is brittle and easy to get wrong.

The [Vercel AI SDK](https://ai-sdk.dev) is a TypeScript-first, framework-agnostic toolkit that provides exactly the abstraction layer we currently build by hand — with 40+ community-maintained providers, a standardised streaming protocol, and first-class SvelteKit support.

This document analyses a full migration (Approach 1), a partial migration (Approach 2), and a no-migration refactor (Approach 3), then provides a head-to-head comparison table and a recommendation.

---

## Current Architecture

### What We Own Today

```
src/lib/server/
├── ai-vendors.ts                  # Vendor registry / factory
├── openai/
│   ├── openai-vendor.ts           # IAIVendor implementation
│   ├── openai-mapping.ts          # ChatRequest ↔ OpenAI API types
│   ├── openai-stream.ts           # OpenAI stream → MuginSse
│   └── openai-files.ts            # File upload helper
├── mistral/
│   ├── mistral-vendor.ts
│   ├── mistral-mapping.ts
│   ├── mistral-stream.ts
│   └── mistral-files.ts
├── ollama/
│   ├── ollama-vendor.ts
│   ├── ollama-mapping.ts
│   └── ollama-stream.ts
└── litellm/
    ├── litellm-vendor.ts
    ├── litellm-mapping.ts
    └── litellm-stream.ts

src/lib/
├── types/AIVendor.ts              # IAIVendor interface
├── types/streaming.ts             # MuginSse Zod discriminated union
├── streaming.ts                   # createSse, createSseParser, parseSse

src/lib/components/Chat/
└── PostChatMessage.svelte.ts      # SSE client (fetch + reader loop)
```

**Total bespoke vendor + streaming code: ~18 files, estimated 1 200–1 500 lines.**

### The Core Pain Points

1. **Boilerplate per vendor.** Each provider requires a vendor class, a mapping file (bidirectional type conversion), and a stream handler that translates vendor-specific event types to `MuginSse`. Adding LiteLLM as a fourth vendor required touching all three layers even though LiteLLM is OpenAI-compatible.

2. **Brittle SSE protocol.** The hand-rolled `createSseParser` handles chunk splitting, the `MuginSse` Zod union validates events, and `PostChatMessage.svelte.ts` drives a manual `ReadableStreamDefaultReader` loop. Any mismatch between server event shape and client Zod schema is a silent failure.

3. **Provider-specific feature creep.** The `IAIVendor` interface flattens providers to a lowest common denominator. Features like file uploads, web search, URL citations, and vendor agents have had to be bolted on awkwardly — file upload lives in a separate `openai-files.ts` helper called from deep in the mapping layer, and `response.searching` / `response.annotations` events were added to `MuginSse` specifically for OpenAI web search.

4. **Provider SDK upgrades are risky.** When OpenAI moved to the `responses` API (from `chat.completions`), we had to rewrite the entire OpenAI mapping and stream handler. The same risk exists for any future SDK change by any provider.

---

## The Vercel AI SDK

### What It Is

The Vercel AI SDK is a TypeScript toolkit maintained by Vercel with broad community adoption. It has two layers:

- **AI SDK Core** (`ai` package): Server-side functions — `generateText`, `streamText`, `generateObject`, `streamObject`. These accept a provider model, messages, tools, and options, and return a standardised result regardless of which provider is used.
- **AI SDK UI** (`@ai-sdk/svelte` for SvelteKit): Client-side state management — the `Chat` class manages message history, loading state, error state, and streaming automatically.

### Provider Support

40+ officially maintained providers including OpenAI, Mistral, Anthropic, Google, Azure, Amazon Bedrock, Groq, Ollama, and LiteLLM (OpenAI-compatible). Each provider is a separate npm package (`@ai-sdk/openai`, `@ai-sdk/mistral`, `@ai-sdk/ollama`, etc.).

Adding a new provider is: `npm install @ai-sdk/newprovider`, then use the model in `streamText()`. No mapping file, no stream handler.

### The Wire Protocol

AI SDK uses its own streaming wire format (`toUIMessageStreamResponse()`). The client-side `Chat` class speaks this protocol natively. The format is richer than raw SSE text — it carries message parts (text deltas, tool calls, tool results, reasoning, sources) and is validated end-to-end by the SDK.

### Provider-Specific Options

The `providerOptions` / `experimental_providerMetadata` parameter is an escape hatch for anything vendor-specific that the SDK doesn't abstract. This is how vendor agents, assistant IDs, and other proprietary features are passed through:

```typescript
streamText({
  model: openai('gpt-4o'),
  messages,
  providerOptions: {
    openai: { assistantId: config.vendorAgent.id }
  }
})
```

---

## Three Approaches

---

### Approach 1: Full Migration to Vercel AI SDK

Replace the entire vendor layer and the SSE client with AI SDK Core + AI SDK UI.

#### Server Side

The four vendor directories, `IAIVendor`, `ai-vendors.ts`, `MuginSse`, and `streaming.ts` are removed. The chat API route becomes:

```typescript
// src/routes/api/chat/+server.ts
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { mistral } from '@ai-sdk/mistral'
import { ollama } from '@ai-sdk/ollama'

export const POST: RequestHandler = async (requestEvent) => {
  return httpRequestMiddleware(requestEvent, async ({ user, requestEvent }) => {
    const body = await requestEvent.request.json()
    const chatRequest = parseChatRequest(body, APP_CONFIG)
    const dbConfig = await chatConfigStore.getChatConfig(chatRequest.config._id)

    if (!canPromptConfig(user, APP_CONFIG, dbConfig)) {
      throw new HTTPError(403, 'Not authorized')
    }

    const model = resolveModel(dbConfig)  // maps vendorId + model → AI SDK model object

    const result = streamText({
      model,
      messages: chatRequest.inputs,
      system: dbConfig.instructions,
      providerOptions: dbConfig.vendorAgent
        ? resolveVendorAgentOptions(dbConfig)
        : undefined,
    })

    return {
      isAuthorized: true,
      response: result.toUIMessageStreamResponse()
    }
  })
}
```

A single `resolveModel()` function replaces the entire vendor registry:

```typescript
const resolveModel = (config: ChatConfig): LanguageModel => {
  switch (config.vendorId) {
    case 'OPENAI':  return openai(config.model, { apiKey: getApiKey('OPENAI', config.project) })
    case 'MISTRAL': return mistral(config.model, { apiKey: getApiKey('MISTRAL', config.project) })
    case 'OLLAMA':  return ollama(config.model)
    case 'LITELLM': return openai(config.model, { baseURL: env.LITELLM_BASE_URL })
  }
}
```

#### Client Side

`PostChatMessage.svelte.ts` and the manual SSE reader loop are removed. `ChatState.svelte.ts` is simplified — the `Chat` class from `@ai-sdk/svelte` handles history, loading, errors, and streaming:

```svelte
<script lang="ts">
  import { Chat } from '@ai-sdk/svelte'

  const chat = new Chat({
    api: '/api/chat',
    body: { config: chatConfig },
  })
</script>

{#each chat.messages as message}
  {#each message.parts as part}
    {#if part.type === 'text'}{part.text}{/if}
  {/each}
{/each}
```

#### File Uploads

AI SDK's `sendMessage` accepts attachments. Files are passed as `experimental_attachments` and forwarded to the provider through the standard messages format. The `openai-files.ts` upload helper would be retained only if OpenAI's file-ID approach (rather than inline data URL) is required — this is a minor residual piece.

#### Vendor Agents

Vendor agents are passed via `providerOptions` in `resolveModel()` / `resolveVendorAgentOptions()`. This is roughly 20 lines of config mapping instead of the current per-vendor class hierarchy.

#### What Is Removed

| File | Status |
|------|--------|
| `src/lib/types/AIVendor.ts` | Deleted |
| `src/lib/server/ai-vendors.ts` | Deleted |
| `src/lib/types/streaming.ts` | Deleted |
| `src/lib/streaming.ts` | Deleted |
| `src/lib/server/openai/openai-vendor.ts` | Deleted |
| `src/lib/server/openai/openai-mapping.ts` | Deleted |
| `src/lib/server/openai/openai-stream.ts` | Deleted |
| `src/lib/server/openai/openai-files.ts` | Deleted — AI SDK handles via attachments API |
| `src/lib/server/mistral/mistral-vendor.ts` | Deleted |
| `src/lib/server/mistral/mistral-mapping.ts` | Deleted |
| `src/lib/server/mistral/mistral-stream.ts` | Deleted |
| `src/lib/server/mistral/mistral-files.ts` | Deleted — AI SDK handles via attachments API |
| `src/lib/server/ollama/ollama-vendor.ts` | Deleted |
| `src/lib/server/ollama/ollama-mapping.ts` | Deleted |
| `src/lib/server/ollama/ollama-stream.ts` | Deleted |
| `src/lib/server/litellm/litellm-vendor.ts` | Deleted |
| `src/lib/server/litellm/litellm-mapping.ts` | Deleted |
| `src/lib/server/litellm/litellm-stream.ts` | Deleted |
| `src/lib/components/Chat/PostChatMessage.svelte.ts` | Deleted |
| `src/lib/components/Chat/ChatState.svelte.ts` | Major rewrite |

**Estimated deletion: ~18 files, ~1 200–1 400 lines. Added: ~150–200 lines.**

---

### Approach 2: Server-Side Only — Keep MuginSse Client

Replace only `IAIVendor` + mapping + stream handlers with `streamText()`. Iterate AI SDK's `fullStream` and emit `MuginSse` events manually. Client is untouched.

```typescript
// Replaces each {vendor}-stream.ts
const result = streamText({ model, messages })
return new ReadableStream({
  async start(controller) {
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        controller.enqueue(createSse({ event: 'response.output_text.delta', data: { itemId: 'main', content: chunk.textDelta } }))
      }
      if (chunk.type === 'finish') {
        controller.enqueue(createSse({ event: 'response.done', data: { usage: { ... } } }))
      }
    }
    controller.close()
  }
})
```

**Gains:** Eliminates 12 vendor files. Vendor SDK upgrades are handled upstream.  
**Retains:** `MuginSse`, `streaming.ts`, `PostChatMessage.svelte.ts`, `IAIVendor` (can be simplified or removed). Still owns the SSE parser. Still needs a small translation layer from AI SDK chunk types to `MuginSse` events.

---

### Approach 3: No Migration — Targeted Refactor

Keep the current architecture. Reduce boilerplate by extracting a shared `BaseVendor` abstract class and a generic stream scaffold:

```typescript
abstract class BaseVendor implements IAIVendor {
  protected abstract getClient(project: string): unknown
  protected abstract buildRequest(chatRequest: ChatRequest): unknown
  protected abstract mapStreamChunk(chunk: unknown): MuginSse | null

  async createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream> {
    const client = this.getClient(chatRequest.config.project)
    const stream = await this.startStream(client, chatRequest)
    return this.wrapStream(stream)
  }
  // ...
}
```

**Gains:** No migration risk. All current capabilities preserved. Moderate boilerplate reduction.  
**Retains:** Full ownership of every layer. Every new provider still requires meaningful work. No upstream maintenance benefit.

---

## Head-to-Head Comparison

| Dimension | Current System | Approach 1: Full AI SDK | Approach 2: Server-Side AI SDK | Approach 3: Refactor Only |
|---|---|---|---|---|
| **Lines of bespoke vendor code** | ~1 200–1 500 | ~150–200 | ~400–500 | ~800–1 000 |
| **Adding a new provider** | 3–4 new files, ~200 lines | `npm install` + ~10 lines | `npm install` + ~30 lines | 3–4 new files, ~150 lines |
| **Provider SDK upgrade risk** | High — own every mapping | Low — upstream owned | Low — upstream owned | High — own every mapping |
| **Streaming client complexity** | High — manual SSE reader loop | None — `Chat` class handles it | High — unchanged | High — unchanged |
| **SSE protocol ownership** | Full | None — SDK owned | Full | Full |
| **Wire format flexibility** | Full — custom events possible | Low — SDK protocol only | Full | Full |
| **Vendor agent support** | Native per-vendor | Via `providerOptions` (~20 lines) | Via `providerOptions` (~20 lines) | Native per-vendor |
| **File upload support** | Custom per-vendor | AI SDK attachments API | AI SDK attachments API | Custom per-vendor |
| **Web search / annotations** | Custom `response.searching` event | Via AI SDK `sources` parts | Requires custom event mapping | Custom events |
| **Per-project API keys** | Native | Manual factory (~20 lines) | Manual factory (~20 lines) | Native |
| **Mistral `beta.conversations`** | Used (stateful) | Not used (standard completions) | Not used (standard completions) | Used (stateful) |
| **Dependency count** | 3 vendor SDKs + hand-rolled SSE | 3 AI SDK provider packages | 3 AI SDK provider packages | 3 vendor SDKs |
| **Community maintenance** | None — fully bespoke | High — 40+ providers, active OSS | Partial | None |
| **SvelteKit idiom alignment** | Custom | Native (`@ai-sdk/svelte`) | Partial | Custom |
| **Migration effort** | — | High — full rewrite | Medium | Low |
| **Migration risk** | — | High — touches client + server | Medium — server only | Low |
| **Test surface change** | — | Large — new tests needed | Medium | Small |
| **Long-term maintenance burden** | High | Low | Medium | Medium |
| **Control over internals** | Full | Low | Medium | Full |

---

## Key Trade-offs in Depth

### What You Give Up in Approach 1

**1. The Mistral `beta.conversations` stateful API**

Currently, Mistral conversations carry a `conversationId` server-side, and the Mistral SDK manages turn history. With AI SDK, you drop to standard chat completions — the client sends full history each turn (the pattern all other vendors already use). This is actually simpler and more consistent. The only loss is if Mistral's server-side context window management was being relied upon implicitly. Given the team's assessment that this is "incidental," this is an acceptable trade.

**2. Full control of the SSE wire format**

The current `MuginSse` protocol supports custom events like `response.searching` (web search in progress) and `response.annotations` (URL citations with index positions). AI SDK's `toUIMessageStreamResponse()` has equivalents — tool call progress maps to web search progress, and `sources` parts carry URL citations — but the mapping is not exact. If the UI needs to show a "searching the web..." indicator or render inline citations with precise character positions, this will need careful validation against what AI SDK's stream parts actually provide.

**3. Direct SDK feature access**

The current system uses OpenAI's `responses` API (not `chat.completions`), which provides features like stateful prompt caching and the `prompt.id` pattern for predefined OpenAI assistants. AI SDK defaults to `chat.completions`. Provider-specific features are accessible via `providerOptions`, but this is a passthrough — not all `responses` API features are exposed.

### What You Gain in Approach 1

**1. Elimination of the mapping tax**

Every provider feature (image input, file input, tool use, structured output) currently requires adding a case to the mapping file and testing it. With AI SDK, these are handled by the provider package. The OpenAI `input_file` → `file_id` upload pattern, for example, is handled by `@ai-sdk/openai` — not by `openai-mapping.ts`.

**2. Client-side state management for free**

`ChatState.svelte.ts` is currently a large, complex class managing streaming state manually. The `Chat` class from `@ai-sdk/svelte` provides: message history, loading state, error state, streaming text accumulation, tool call state, and abort control. This is the biggest quality-of-life gain in the entire migration.

**3. Consistent multi-modal handling**

Files and images today have slightly different handling paths per vendor. AI SDK normalises attachments across providers — the same `experimental_attachments` API works for OpenAI, Mistral, and Anthropic. MIME type validation still needs to live in the application layer (as `vendor-constants.ts`), but the plumbing is unified.

**4. Agent/tool loop support**

If Hugin Beta ever needs multi-step agentic calls (model calls a tool, gets result, continues), AI SDK has first-class support via `maxSteps` and `stopWhen`. Building this in the current system would require owning the tool result loop in `ChatState.svelte.ts`.

---

## Risk Assessment

### Approach 1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| AI SDK's `Chat` class doesn't map cleanly to `ChatState` | Medium | High | Prototype `Chat` class integration on a spike branch before committing |
| Web search / annotation UI breaks (different event shape) | Medium | Medium | Audit `response.searching` and `response.annotations` usage in the Svelte components before migration |
| Vendor agent passthrough via `providerOptions` is insufficient for some providers | Low | Medium | Test with both OpenAI `prompt.id` and Mistral `agentId` in a spike |
| AI SDK breaking change in a major version | Low | Medium | Pin major version; AI SDK is stable and widely adopted |
| `openai-files.ts` upload flow needs replacing | Low | Low | AI SDK handles this via `experimental_attachments` |

### Approach 2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| AI SDK `fullStream` chunk types don't map 1:1 to `MuginSse` | Medium | Medium | Audit chunk type list before migration |
| Mix of two abstraction layers creates confusion | Medium | Low | Document clearly which layer owns what |

### Approach 3 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Another major OpenAI/Mistral SDK change breaks mapping | High | High | Accept as ongoing cost |
| Team continues to find adding vendors painful | High | Medium | Accept as ongoing cost |

---

## Recommended Migration Path (if Approach 1 is chosen)

This is not a big-bang rewrite — it should be done in phases on a dedicated branch, with each phase independently testable:

**Phase 1 — Spike (1–2 days)**  
Validate two unknowns before committing:
- Wire up `streamText` for OpenAI on a test route, use AI SDK's `Chat` class in a prototype component, confirm web search and annotations work via `sources` parts
- Test Mistral vendor agent (`agentId`) via `providerOptions`

**Phase 2 — Server-side migration (2–3 days)**  
- Add `@ai-sdk/openai`, `@ai-sdk/mistral`, `@ai-sdk/ollama` packages
- Implement `resolveModel()` factory
- Rewrite `/api/chat` route to use `streamText().toUIMessageStreamResponse()`
- Keep old vendor files in place temporarily; route via feature flag

**Phase 3 — Client-side migration (2–3 days)**  
- Replace `PostChatMessage.svelte.ts` with `Chat` class
- Rewrite `ChatState.svelte.ts` around `Chat` instance
- Update all Svelte components that consume `ChatState`

**Phase 4 — Cleanup (1 day)**  
- Delete all old vendor files, `MuginSse`, `streaming.ts`, `IAIVendor`
- Update tests
- Final `npm run test`

**Total estimated effort: 6–9 days of focused work.**

---

## Conclusion and Recommendation

**Recommendation: Approach 1 — Full migration to Vercel AI SDK.**

The current system's maintenance burden is structural, not incidental. It exists because the team owns a full vendor abstraction layer that is functionally equivalent to what the Vercel AI SDK provides — but without the community maintenance, the provider coverage, or the client-side tooling.

The two blockers that might have prevented this recommendation have been resolved:
- Mistral `beta.conversations` is not relied upon — standard chat completions is acceptable
- Vendor agents are achievable via `providerOptions` with ~20 lines of config mapping

The strongest argument for migrating now is the `ChatState.svelte.ts` and `PostChatMessage.svelte.ts` situation. The AI SDK `Chat` class would eliminate the most complex, hardest-to-test code in the client layer — the manual SSE reader loop, the buffer management, and the streaming state machine. That alone justifies the effort.

The strongest argument against is control: the current system can emit any custom SSE event shape. If the product roadmap requires deeply custom streaming events (beyond what AI SDK's stream parts can express), the bespoke system retains value. For a chat application with standard text, tool calls, web search, and file input, this is unlikely to be a real constraint.

**Suggested next step: a 1–2 day spike on a branch** to validate the `Chat` class integration and the vendor agent `providerOptions` passthrough before deciding to proceed with the full migration.
