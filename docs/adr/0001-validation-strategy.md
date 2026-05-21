# ADR-0001: Runtime Validation Only at Trust Boundaries

## Status
Accepted — implemented May 2026

## Context
The codebase originally used a "Zod-first" approach where Zod schemas were the primary way to define all types, with TypeScript types inferred from schemas. This created maintenance overhead (schema drift, `schemaForType` workaround) and coupled domain type files to a runtime library.

## Decision
Domain types are plain TypeScript. Runtime validation (Zod or plain type guards) is used only where external, untrusted data enters the system.

**Runtime validation is required at:**
- API request bodies (`/api/chat`, `/api/chatconfigs`, `/api/transcription`)
- EasyAuth `X-MS-CLIENT-PRINCIPAL` header
- SSE events parsed from vendor streams
- Environment variables at startup

**Runtime validation is not needed for:**
- Internal function calls between trusted modules
- Domain objects constructed inside trusted code
- Props flowing between Svelte components (server-loaded, already validated)

## Current implementation
| Boundary | Validator | Location |
|----------|-----------|----------|
| `/api/chat` body | Plain type guards | `src/lib/validation/parse-chat-request.ts` |
| `/api/chatconfigs` body | Zod (`ChatConfigSchema`) | `src/lib/validation/parse-chat-config.ts` |
| Transcription route bodies | Zod | `src/lib/validation/transcription.ts` |
| EasyAuth claims | Plain type guards | `src/lib/validation/auth-principal.ts` |
| SSE events | Zod discriminated union | `src/lib/types/streaming.ts` |
| Environment variables | Plain checks | `src/lib/validation/env.ts` |

## Zod placement rule
Zod schemas live in `src/lib/validation/` or `src/lib/types/streaming.ts`. They must not be defined inside route files or domain type files.

## Alternatives considered
- **Zod everywhere:** Rejected — excessive maintenance overhead, `schemaForType` workaround was a code smell
- **No runtime validation:** Rejected — external inputs from users, vendors, and Azure cannot be trusted
- **Replace Zod entirely with plain guards:** Possible in future. Not done now because Zod handles complex nested shapes well and the tests prove its behavior.
