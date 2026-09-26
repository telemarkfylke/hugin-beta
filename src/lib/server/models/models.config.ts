import type { CatalogueModel, ModelConfig, Profile } from "./types"

// THE place to add, retire or remap models - see CLAUDE.md "Adding or changing a model".
//   Add a model:        one line in MODELS
//   Upgrade a profile:  change its `model`
//   Retire a model:     status: "retired" + map its providerModel in LEGACY
// A typo in a profile/default/LEGACY value is a type error; everything else is checked at startup
// by assertModelConfig.

const MODELS = {
	"gpt-4o": { vendor: "OPENAI", providerModel: "gpt-4o", files: "openai", capabilities: ["webSearch"], status: "retired" },
	"gpt-4": { vendor: "OPENAI", providerModel: "gpt-4", files: "openai", capabilities: ["webSearch"], status: "retired" },
	"gpt-4.1": { vendor: "OPENAI", providerModel: "gpt-4.1", files: "openai", capabilities: ["webSearch"], status: "retired" },
	"gpt-5.2": { vendor: "OPENAI", providerModel: "gpt-5.2", files: "openai", capabilities: ["webSearch"], status: "retired" },
	"gpt-5.4": { vendor: "OPENAI", providerModel: "gpt-5.4", files: "openai", capabilities: ["webSearch"], status: "retired" },
	"gpt-5.5": { vendor: "OPENAI", providerModel: "gpt-5.5", files: "openai", capabilities: ["webSearch"], status: "retired" },
	"gpt-5.6-terra": { vendor: "OPENAI", providerModel: "gpt-5.6-terra", files: "openai", capabilities: ["webSearch"] },
	"gpt-6-sol": { vendor: "OPENAI", providerModel: "gpt-6-sol", files: "openai", capabilities: ["webSearch"] },
	"gpt-6-luna": { vendor: "OPENAI", providerModel: "gpt-6-luna", files: "openai", capabilities: ["webSearch"] },
	"gpt-5.6-luna": { vendor: "OPENAI", providerModel: "gpt-5.6-luna", files: "openai", capabilities: ["webSearch"] },
	"mistral-medium": { vendor: "MISTRAL", providerModel: "mistral-medium-latest", files: "mistral", capabilities: ["webSearch"], status: "retired" },
	"mistral-large": { vendor: "MISTRAL", providerModel: "mistral-large-latest", files: "mistral", capabilities: ["webSearch"] },
	"ollama-llama3": { vendor: "OLLAMA", providerModel: "llama3:8b", files: "none", capabilities: [], status: "retired" },
	"ollama-normistral": { vendor: "OLLAMA", providerModel: "LTG/normistral-11b-thinking:latest", files: "none", capabilities: [], status: "retired" },
	normistral: { vendor: "LITELLM", providerModel: "norallm/normistral-11b-thinking", files: "none", capabilities: [] },
	// Small, mechanical text tasks (RAG query rewriting, conversation titles, question categories) via
	// the KI-server LiteLLM gateway. Must also be on the KI-server's own model allow-list. Avoid
	// "thinking" variants - the extra reasoning pass is wasted latency here. UTILITY_LLM_MODEL in env
	// overrides providerModel (see model-registry.ts).
	"llama3-utility": { vendor: "LITELLM", providerModel: "llama3:8b-instruct-q5_K_M", files: "none", capabilities: [], internal: true }
} satisfies Record<string, CatalogueModel>

type ModelKey = keyof typeof MODELS
type ProfileId = "rask" | "grundig" | "europeisk" | "lokal"

const PROFILES: (Profile & { id: ProfileId; model: ModelKey })[] = [
	{ id: "rask", label: "Rask", icon: "⚡", description: "Raske svar på enkle oppgaver", model: "gpt-6-luna" },
	{ id: "grundig", label: "Grundig", icon: "🧠", description: "Analyse, resonnering og lange dokumenter", model: "gpt-6-sol" },
	{ id: "europeisk", label: "Europeisk", icon: "🇪🇺", description: "Data behandles innenfor EU", model: "mistral-large", dataLocation: "EU" },
	{
		id: "lokal",
		label: "Lokal",
		icon: "🏠",
		description: "Data forlater aldri fylkeskommunens servere",
		model: "normistral",
		dataLocation: "Egne servere",
		roles: ["employee", "edu_employee"]
	}
]

const DEFAULTS: { chat: ProfileId; assistant: ProfileId; canvas: ProfileId; utility: ModelKey } = {
	chat: "europeisk",
	assistant: "europeisk",
	canvas: "grundig",
	utility: "llama3-utility"
}

// Only needed for provider IDs that no profile uses directly - a stored model a profile uses maps to that profile automatically
const LEGACY: Record<string, ProfileId> = {
	"gpt-4o": "rask",
	"gpt-4": "rask",
	"gpt-4.1": "rask",
	"gpt-5.2": "rask",
	"gpt-5.4": "rask",
	"gpt-5.5": "grundig",
	// Grundig's previous model - no profile uses it directly any more
	"gpt-5.6-terra": "grundig",
	// Rask's previous model - no profile uses it directly any more
	"gpt-5.6-luna": "rask",
	"mistral-medium-latest": "europeisk",
	"llama3:8b": "lokal",
	"LTG/normistral-11b-thinking:latest": "lokal",
	// Local-server models from earlier app-config.ts versions - must never migrate to a cloud profile
	"gemma:2b": "lokal",
	"LTG/normistral-11b-thinking": "lokal",
	llama3: "lokal"
}

export const MODEL_CONFIG: ModelConfig = { MODELS, PROFILES, DEFAULTS, LEGACY }
