import type {
	Access,
	AccessRow,
	AccessType,
	ChunkInput,
	CreateVectorStoreInput,
	EmbeddingDimensions,
	EmbeddingModel,
	GraphGroup,
	GraphUser,
	StoreConfig,
	StoreResponse,
	UnrestrictedAccess,
	UpdateStoreValues,
	VectorMatch,
	VectorSearch,
	VectorStoreFile
} from "../types"

const BASE = "/api/obo/rag"

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

	async uploadFile(storeId: string, formData: FormData, normalizeChuncks: boolean): Promise<Response> {
		let url = `${BASE}/stores/${storeId}/textfiles`
		if (normalizeChuncks) url += "?normalizeChunks=true"
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

	async textSearch(storeId: string, query: VectorSearch): Promise<VectorMatch[]> {
		return (await post<VectorMatch[]>(`/stores/${storeId}/search/text`, query)) ?? []
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
