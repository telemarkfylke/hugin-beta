export type VectorStoreFile = {
	id: string
	name: string
	type: string
	bytes: number
	status: string
	summary?: string
}

export type StoreState = {
	storeId: string
	error?: string | null
	isLoading: boolean
	vectorStoreFiles: VectorStoreFile[]
}

export type EmbeddingDimensions = 512 | 768 | 1024
export type EmbeddingModel = "embeddinggemma:300m" | "mock" | "voyage-4-lite" | "voyage-4-large" | "voyage-4" | "voyage-context-3" | "voyage-multimodal-3.5" | "qwen3-embedding"

export type SearchWeights = {
	text?: number
	vector?: number
}

export type SearchThresholds = {
	text?: number | null
	vector?: number | null
	logic?: "and" | "or"
}

export type SearchOptions = {
	thresholds?: SearchThresholds | null
	weights?: SearchWeights | null
}

export type CreateVectorStoreInput = {
	name: string
	description: string
	embeddingMethod: EmbeddingModel
	dimensions: EmbeddingDimensions
	supportVision?: boolean
	searchOptions?: SearchOptions | null
}

export type StoreConfig = CreateVectorStoreInput & {
	storeId: string
	createdAt: string
	createdBy: {
		id: string
		name: string
	}
}

// The only values that we allow to be altered after creation
export type UpdateStoreValues = {
	name?: string
	description?: string
	searchOptions?: SearchOptions | null
}

export type StoreResponse = StoreConfig & {
	_embedded: {
		access: AccessRow
	}
}

export type StoreWrapper = {
	config: StoreConfig
	files: Record<string, VectorStoreFile>
	access: Access
}

export type VectorMatch = {
	id?: string
	storeId: string
	fileId: string
	score: number
	vectorScore: number | null
	textScore: number | null
	text: string
	extraInfo?: Record<string, unknown>
}

export type ChunkInput = {
	data: string
	extraInfo?: Record<string, unknown>
}

export type VectorSearch = {
	text: string
	storeIds?: string[]
	replyLimit: number
	weights?: SearchWeights | null
	thresholds?: SearchThresholds | null
}

export type AccessRow = {
	view: boolean
	search: boolean
	upload: boolean
	admin: boolean
	name?: string | undefined
}

export type Access = {
	users?: Record<string, AccessRow>
	roles?: Record<string, AccessRow>
	groups?: Record<string, AccessRow>
}

export type UnrestrictedAccess = {
	view: boolean
	search: boolean
}

export type AccessLevel = "view" | "search" | "upload" | "admin"

export type AccessType = "user" | "group" | "role"

export type AccessFlat = AccessRow & {
	id: string
	type: AccessType
}

export type GraphUser = {
	id: string
	displayName: string
	mail: string
	userPrincipalName: string
}

export type GraphGroup = {
	id: string
	displayName: string
}
