export type OllamaErrorKind = "auth" | "model-not-found" | "bad-gateway" | "http-error" | "dns" | "refused" | "timeout" | "tls" | "network" | "unknown"

export type OllamaErrorInfo = { kind: OllamaErrorKind; status?: number; code?: string }

const NETWORK_CODES: Record<string, OllamaErrorKind> = {
	ENOTFOUND: "dns",
	EAI_AGAIN: "dns",
	ECONNREFUSED: "refused",
	ECONNRESET: "network",
	EHOSTUNREACH: "network",
	ENETUNREACH: "network",
	ETIMEDOUT: "timeout",
	UND_ERR_CONNECT_TIMEOUT: "timeout",
	UND_ERR_HEADERS_TIMEOUT: "timeout",
	UND_ERR_BODY_TIMEOUT: "timeout",
	CERT_HAS_EXPIRED: "tls",
	DEPTH_ZERO_SELF_SIGNED_CERT: "tls",
	UNABLE_TO_VERIFY_LEAF_SIGNATURE: "tls"
}

// Boils a failed Ollama call down to something filterable in the logs. The ollama client throws a
// ResponseError (status_code) for HTTP failures, and a "fetch failed" TypeError whose cause carries the
// socket error code for everything below HTTP (DNS, refused, timeout, TLS).
export const classifyOllamaError = (error: unknown): OllamaErrorInfo => {
	const status = (error as { status_code?: unknown } | null)?.status_code
	if (typeof status === "number") {
		if (status === 401 || status === 403) {
			return { kind: "auth", status }
		}
		if (status === 404) {
			return { kind: "model-not-found", status }
		}
		if (status === 502 || status === 503 || status === 504) {
			return { kind: "bad-gateway", status }
		}
		return { kind: "http-error", status }
	}
	const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code ?? (error as { code?: unknown } | null)?.code
	if (typeof code === "string") {
		return { kind: NETWORK_CODES[code] ?? "network", code }
	}
	return { kind: "unknown" }
}
