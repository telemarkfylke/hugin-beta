import type {
	Access,
	AccessRow,
	AccessType,
	ChunkInput,
	CreateVectorStoreInput,
	EmbeddingDimensions,
	EmbeddingModel,
	FileUsage,
	GraphGroup,
	GraphUser,
	StoreConfig,
	StoreResponse,
	UnrestrictedAccess,
	UpdateStoreValues,
	UseOcr,
	VectorMatch,
	VectorSearch,
	VectorStoreFile
} from "../types"

const BASE = "/api/obo/rag"

// A real search can legitimately take a while (embedding + vector + text search combined), so
// this is generous - it's a "stop hanging forever" backstop, not a normal-latency budget.
const SEARCH_TIMEOUT_MS = 30_000

async function get<T>(path: string): Promise<T | null> {
	try {
		const res = await fetch(`${BASE}${path}`)
		if (!res.ok) return null
		return (await res.json()) as T
	} catch {
		return null
	}
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
	try {
		const res = await fetch(`${BASE}${path}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body)
		})
		if (!res.ok) return null
		return (await res.json()) as T
	} catch {
		return null
	}
}

async function put<T>(path: string, body: unknown): Promise<T | null> {
	try {
		const res = await fetch(`${BASE}${path}`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body)
		})
		if (!res.ok) return null
		return (await res.json()) as T
	} catch {
		return null
	}
}

async function patch<T>(path: string, body: unknown): Promise<T | null> {
	try {
		const res = await fetch(`${BASE}${path}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body)
		})
		if (!res.ok) return null
		return (await res.json()) as T
	} catch {
		return null
	}
}

async function del(path: string): Promise<boolean> {
	try {
		const res = await fetch(`${BASE}${path}`, { method: "DELETE" })
		return res.ok
	} catch {
		return false
	}
}

// Ragservice's own message from a refused call ({ message }), or the fallback
async function errorMessage(res: Response, fallback: string): Promise<string> {
	try {
		const body = (await res.json()) as { message?: string }
		return body.message ? `${fallback}: ${body.message}` : `${fallback} (${res.status})`
	} catch {
		return `${fallback} (${res.status})`
	}
}

export class RagServiceApi {
	async getModels(): Promise<EmbeddingModel[]> {
		return (await get<EmbeddingModel[]>("/models")) ?? []
	}

	async getDimensions(model: EmbeddingModel): Promise<EmbeddingDimensions[]> {
		return (await get<EmbeddingDimensions[]>(`/models/${model}/dimensions`)) ?? []
	}

	async getStores(): Promise<StoreConfig[]> {
		return (await get<StoreConfig[]>("/stores/")) ?? []
	}

	async createStore(config: CreateVectorStoreInput): Promise<StoreConfig | null> {
		return await post<StoreConfig>("/stores/", config)
	}

	async getStore(id: string, _extendedInfo: boolean): Promise<StoreResponse | null> {
		return await get<StoreResponse>(`/stores/${id}`)
	}

	async updateStore(id: string, values: UpdateStoreValues): Promise<StoreConfig | null> {
		return await patch<StoreConfig>(`/stores/${id}`, values)
	}

	async deleteStore(id: string): Promise<boolean> {
		return await del(`/stores/${id}`)
	}

	// Uploads never index: a file starts as file content, and indexing is its own deliberate action (indexFile) -
	// so nobody starts a long-running indexing job just by uploading.
	async uploadFile(storeId: string, formData: FormData, useOcr: UseOcr = "auto"): Promise<Response> {
		let url = `${BASE}/stores/${storeId}/textfiles`
		const params = new URLSearchParams({ index: "false" })
		if (useOcr !== "auto") params.set("useOcr", useOcr)
		const query = params.toString()
		if (query) url += `?${query}`
		return await fetch(url, {
			method: "POST",
			body: formData
		})
	}

	async getFiles(storeId: string): Promise<VectorStoreFile[]> {
		return (await get<VectorStoreFile[]>(`/stores/${storeId}/files`)) ?? []
	}

	async removeFile(storeId: string, fileId: string): Promise<boolean> {
		return await del(`/stores/${storeId}/files/${fileId}`)
	}

	// Throws with ragservice's own message, so the file list can say why a choice was refused
	async setFileUsage(storeId: string, fileId: string, usage: FileUsage): Promise<FileUsage> {
		const res = await fetch(`${BASE}/stores/${storeId}/files/${fileId}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ usage })
		})
		if (!res.ok) throw new Error(await errorMessage(res, "Kunne ikke endre bruken av filen"))
		return ((await res.json()) as { usage: FileUsage }).usage
	}

	/**
	 * Starts indexing a stored file and waits until it is done. Ragservice answers with a stream of progress events
	 * ending in "Done" or "error"; the file list follows progress by polling, so this only reads the stream to the
	 * end to find out how it went. Throws on a refusal (e.g. already indexed) or a failed indexing.
	 * "pending": a gateway or the network gave up before indexing finished (it takes minutes for big files) - the
	 * job keeps running in ragservice, and the file's status shows how it ends. Same reasoning as FileUpload.
	 */
	async indexFile(storeId: string, fileId: string, normalizeChunks = true): Promise<"done" | "pending"> {
		const params = normalizeChunks ? "?normalizeChunks=true" : ""
		let res: Response
		let events: string
		try {
			res = await fetch(`${BASE}/stores/${storeId}/files/${fileId}/index${params}`, { method: "POST" })
			if (res.status === 502 || res.status === 503 || res.status === 504) return "pending"
			if (!res.ok) throw new Error(await errorMessage(res, "Kunne ikke starte indekseringen"))
			events = await res.text()
		} catch (error) {
			// fetch itself failing (a dropped connection) - not a refusal, which is thrown above as an Error with our text
			if (error instanceof TypeError) return "pending"
			throw error
		}
		// The events are JSON objects written back to back - the last one says how it ended
		let last: { event?: string; data?: { message?: string } } = {}
		try {
			last = JSON.parse(events.slice(events.lastIndexOf('{"event":')))
		} catch {
			throw new Error("Indekseringen ga et uventet svar")
		}
		if (last.event === "error") throw new Error(`Indekseringen feilet: ${last.data?.message ?? "ukjent feil"}`)
		return "done"
	}

	async removeFileIndex(storeId: string, fileId: string): Promise<void> {
		const res = await fetch(`${BASE}/stores/${storeId}/files/${fileId}/index`, { method: "DELETE" })
		if (!res.ok) throw new Error(await errorMessage(res, "Kunne ikke fjerne indeksen"))
	}

	// Deliberately doesn't go through the shared post() helper: that swallows every failure into
	// null, which textSearch would otherwise turn into an empty array - indistinguishable from a
	// real "no matches" result. Callers need to tell those apart to show a proper error instead
	// of silently rendering nothing (see DataStoreTextSearch's searchError).
	async textSearch(storeId: string, query: VectorSearch): Promise<VectorMatch[]> {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
		try {
			const res = await fetch(`${BASE}/stores/${storeId}/search/text`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(query),
				signal: controller.signal
			})
			if (!res.ok) throw new Error(`Søket feilet (${res.status})`)
			return (await res.json()) as VectorMatch[]
		} finally {
			clearTimeout(timeout)
		}
	}

	async getAccess(storeId: string): Promise<Access> {
		return (
			(await get<Access>(`/stores/${storeId}/access/`)) ?? {
				unrestricted: {
					view: false,
					search: false
				}
			}
		)
	}

	async setAccess(storeId: string, type: AccessType, userId: string, accessRow: AccessRow): Promise<void> {
		await put(`/stores/${storeId}/access/${this.typePath(type)}/${userId}`, accessRow)
	}

	async removeAccess(storeId: string, type: AccessType, userId: string): Promise<void> {
		await del(`/stores/${storeId}/access/${this.typePath(type)}/${userId}`)
	}

	async getUnrestrictedAccess(storeId: string): Promise<UnrestrictedAccess | null> {
		return await get<UnrestrictedAccess>(`/stores/${storeId}/access/unrestricted`)
	}

	async setUnrestrictedAccess(storeId: string, access: UnrestrictedAccess): Promise<void> {
		await put(`/stores/${storeId}/access/unrestricted`, access)
	}

	async deleteUnrestrictedAccess(storeId: string): Promise<void> {
		await del(`/stores/${storeId}/access/unrestricted`)
	}

	async searchUsers(query: string): Promise<GraphUser[]> {
		return (await get<GraphUser[]>(`/entities/graph/users?search=${encodeURIComponent(query)}`)) ?? []
	}

	async searchGroups(query: string): Promise<GraphGroup[]> {
		return (await get<GraphGroup[]>(`/entities/graph/groups?search=${encodeURIComponent(query)}`)) ?? []
	}

	async addChunks(storeId: string, chunks: ChunkInput[]): Promise<boolean> {
		const res = await post<unknown>(`/stores/${storeId}/chunks`, chunks)
		return res !== null
	}

	async updateChunk(storeId: string, chunkId: string, chunk: ChunkInput): Promise<boolean> {
		try {
			const res = await fetch(`${BASE}/stores/${storeId}/chunks/${chunkId}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(chunk)
			})
			return res.ok
		} catch {
			return false
		}
	}

	async deleteChunk(storeId: string, chunkId: string): Promise<boolean> {
		return await del(`/stores/${storeId}/chunks/${chunkId}`)
	}

	private typePath(type: AccessType): string {
		if (type === "group") return "groups"
		if (type === "user") return "users"
		return ""
	}
}
