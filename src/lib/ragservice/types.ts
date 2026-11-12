export type VectorStoreFile = {
	id: string
	name: string
	type: string
	bytes: number
	status: string
	summary?: string
	languages?: StoreLanguage[]
	/** E.g. "350 / 362" (chunks behandlet / totalt) mens filen prosesseres. */
	progress?: string
	/** Set when the original is stored in S3. Missing on files uploaded before storage existed ("original mangler"). */
	original?: { contentType: string; bytes: number }
	/** Set when the parsed full text is stored. `characters` gives the size; "markdown" only for Docling output. */
	text?: { characters: number; format?: "markdown" | "plain" }
	/** Chunked and embedded (searchable). Missing on old files, which were always indexed once done - see isFileIndexed. */
	indexed?: { chunks: number } | false
	/** How bots may use the file - always the effective value from ragservice, also for old files. */
	usage: FileUsage
}

/**
 * How bots may use one file, chosen per file in the file list. The four combinations are the four choices there:
 * Deaktivert, Fil-innhold, Søk, Søkbar + Fil-innhold. Search needs an indexed file, file content a stored text.
 */
export type FileUsage = {
	search: boolean
	fullText: boolean
}

export type StoreState = {
	storeId: string
	error?: string | null
	isLoading: boolean
	vectorStoreFiles: VectorStoreFile[]
}

export type EmbeddingDimensions = 512 | 768 | 1024
export type EmbeddingModel = "embeddinggemma:300m" | "mock" | "voyage-4-lite" | "voyage-4-large" | "voyage-4" | "voyage-context-3" | "voyage-multimodal-3.5" | "qwen3-embedding"
export type UseOcr = "true" | "false" | "auto"

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
	rerank?: boolean | null
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

export type StoreLanguage = {
	language: string
	percentage: number
}

// Response of the search-scoped GET /stores/{storeId}/searchinfo - unlike the full store object,
// this only requires search access, so it's safe to call from the query-rewrite path.
export type StoreSearchInfo = {
	/** Store-wide language aggregate (see `StoreOutput.languages` for how it's computed). */
	languages?: StoreLanguage[]
	/** `characters` only when the file's content may be given to a bot (usage.fullText). */
	files: { id: string; name: string; languages?: StoreLanguage[]; indexed: boolean; usage: FileUsage; characters?: number }[]
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
	fileName?: string
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
	rerank?: boolean | null
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
	unrestricted: UnrestrictedAccess
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
