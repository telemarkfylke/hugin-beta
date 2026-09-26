# Model profiles — remaining work after the deep review

Branch: `modelabstraction`. The deep review (2026-09-26) ran as multiple review angles plus verifiers.
It was interrupted, then completed the same day with a separate review of the fix commit `7f87b5b` and
a sweep of the whole branch. Confirmed findings are fixed in `7f87b5b` and in the follow-up commit (A–D
below). This file lists what is left.

Fixed in the follow-up commit:
- A: automatic department pins are marked `pinned.legacy`. The assistant's editors may clear them (choose
  a profile → default key), and the UI explains this instead of claiming an admin locked it. `legacy` is
  only ever carried over from the stored config, never trusted from a client.
- B: the department pin is also built while the vendor is disabled, so a save during an outage can't lose
  the project.
- C: stored configs with an unknown or lowercase `vendorId` (early versions) no longer crash resolution
  (which would 500 the agents list).
- D: reopening an old conversation keeps the assistant's current profile and pin, not the snapshot's.

## Before production (rollout checks)

Run these read-only queries against the prod DB (collection `chat-configs`) before deploying:

- `db["chat-configs"].distinct("model", { vendorAgent: { $exists: false } })`
  Every value must be a provider model used by a profile, or be listed in `LEGACY` in
  `src/lib/server/models/models.config.ts`. Anything else silently falls back to `DEFAULTS.assistant`
  (a warning is logged: "fell back to default profile").
- `db["chat-configs"].countDocuments({ vendorAgent: { $exists: false }, project: { $ne: "DEFAULT" } })`
  These assistants become implicit admin pins on their own project (fixed in `7f87b5b`). Check that each
  project's key (`OPENAI_API_KEY_PROJECT_<NAME>` / `MISTRAL_API_KEY_PROJECT_<NAME>`) exists in the prod
  env. Otherwise the pin is skipped and the assistant falls back to `DEFAULT`.
- `db["chat-configs"].distinct("vendorId")`: anything besides OPENAI/MISTRAL/OLLAMA/LITELLM is a very old
  config (lowercase ids). It no longer crashes, but it falls back to the default profile.
- Check that `LITELLM_BASE_URL` / `LITELLM_API_KEY` are set in prod. If they aren't, the "Lokal" profile
  is hidden and existing Lokal assistants answer 503 (fail closed because of the data location).

Manual browser test on beta (nobody has clicked through this yet):

- Switching profile updates the allowed file types and the web search button.
- Admin: pin, re-pin to another vendor, "Tilbakestill til profil".
- Non-admin on a pinned assistant: the list is locked and saving works.
- Open an old conversation and save the assistant: no 400.
- An old assistant with its own project answers, and "Avansert" shows the right project. As a non-admin, the
  note about the department's key appears and choosing a profile works (moves it to the default key).
- Toggle manual ↔ predefined (vendor agent).

## Open findings (confirmed, not fixed)

| # | Finding | Severity | Suggested fix |
|---|---|---|---|
| 1 | **Unknown `pinned.project` in `/api/chat` gives 500 instead of 400.** It also happens when ops removes a project key that a pin still uses: every message fails with 500. | Low (bad input or ops change, no new access) | In `resolve.ts`, treat a pin whose project isn't in `vendorProjects(vendor)` as unusable (fall back to the profile), or return 400 in use mode. |
| 2 | **No usable profile at all** (e.g. local dev with only `OLLAMA_HOST`, since the Ollama models are retired): the app starts, but `/` and the assistant lists return 500 because `resolveChatConfig` throws. `src/routes/+page.server.ts` resolves at module load. | Low (local dev / misconfig) | Fail at startup with a clear message, or have the home page resolve lazily and show a friendly error. |
| 3 | **The same warning is logged on every read** while something is degraded (disabled vendor, retired pin): the Menu, the agents list, every chat message, and 3× per save. This adds BetterStack volume. | Low | Log once per config id per process (a Set), or log degraded profiles once at startup. |
| 4 | **Utility model on OpenAI/Mistral would be rejected.** `DEFAULTS.utility` must be `internal`, but internal models are left out of `VENDORS[*].MODELS`, and the OpenAI/Mistral allow-lists reject them. The error is swallowed (no titles, no query rewrite, the scope guard lets everything through). The shipped config (LiteLLM) is not affected. | Latent | Document "utility must be LITELLM/OLLAMA" in `models.config.ts` and have `assertModelConfig` check it, or let the allow-lists include internal models. |
| 5 | **New assistants and the home chat default to OpenAI when Mistral is off.** `DEFAULTS` points at Europeisk (dataLocation EU), but `resolveDefaultProfileId` falls back to the first usable profile (Rask), while an existing Europeisk assistant fails closed with 503. The two rules disagree. (Not fully verified.) | Low (misconfig) | Decide: fail closed for a dataLocation default too, or accept the fallback for new assistants. |
| 6 | **`/api/chat` trusts the client-sent config.** Profile, pin and project come from the browser, so profile roles and admin pins only restrict what is *saved*, not what is *used*. This is not new (before, the client could send any `vendorId`/`model`), and it's noted as a follow-up in the spec. The public embed route already loads the config from the DB. | Moderate (pre-existing) | For saved assistants (`config._id`), load the stored config by `_id` in `/api/chat` and only accept per-message fields from the client. |
| 7 | **Duplicated rules between client and server:** "may choose profile", "pinnable model" and "is admin" are written separately in `parse-chat-config.ts`, `model-profiles.ts`, `ProfilePicker.svelte` and `AgentCard.svelte`. | Maintainability | Named helpers `canChooseProfile`, `isPinnableModel` and `canPinModel` in `model-profiles.ts` / `authorization.ts`, used on both sides. |
| 8 | **Canvas repeats its setup in three routes** (`api/canvas`, `mermaid`, `presentation`): the same `getDefaultModel("canvas")`, 503 and ChatConfig literal, and `web_search` is added regardless of the model's capability. | Maintainability | One helper (`buildCanvasConfig(name, instructions, webSearch)`) that also gates `web_search` on the `webSearch` capability. |
| 9 | **The pin note contradicts itself** when the pin is unavailable: "låst til X (ikke tilgjengelig – følger profilen) og følger ikke profilendringer". | Cosmetic | Separate wording for an unavailable pin. |
| 10 | **The "Lås til modell" select can't show a retired pinned model** (the option is filtered out). | Cosmetic | Add the pinned model as a disabled option when it isn't in the list. |
| 11 | **`manualConfigCache` in ChatConfigPanel has no guard** for `defaultProfileSelection` returning null (no usable profile). | Low | Same guard as `agents/create`. |
| 12 | **`app-config.ts` only logs an error when no profile at all is usable,** not when `DEFAULTS.chat`/`assistant` themselves are disabled (the spec asks for an error). | Low | Log an error when a default profile's vendor is disabled. |

## Design question (from the review, not a bug today)

- The store writes the *resolved* fields (vendorId/model/project) to the DB on save, and they are later
  read as input (e.g. `legacyProfileId` for configs without a profile). Consider persisting only
  `profile`/`pinned`. The sweep found no concrete failure from this after the A–D fixes.

## Unrelated, noted during the work

- Dependabot: `vitest` / `@vitest/mocker` < 4.1.11 (path traversal in the redirect mock, dev dependency).
  Fix: `npm install -D vitest@^4.1.11`.
- `.env.example` doesn't list `LITELLM_BASE_URL` / `LITELLM_API_KEY`.
