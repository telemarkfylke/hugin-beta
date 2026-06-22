import type { Access, AccessRow, CreateVectorStoreInput, EmbeddingDimensions, EmbeddingModel, VectorMatch, VectorSearch, StoreConfig, VectorStoreFile, StoreWrapper, StoreResponse, AccessType, GraphUser, GraphGroup } from "../types"
import { getToken } from '../../token';
//const { ragserviceurlRAGSERVICE_URL: ragserviceurl, MOCK_USER_ID: mockUserId, MOCK_USER_NAME: mockUserName, } = import.meta.env;


const { VITE_RAGSERVICE_URL: ragserviceurl } = import.meta.env;
const { VITE_MOCK_USER_ID: mockUserId } = import.meta.env;
const { VITE_MOCK_USER_NAME: mockUserName } = import.meta.env;

const env = import.meta.env;

export class RagServiceApi {

	private baseUrl: string = ragserviceurl || 'http://localhost:7071'

	constructor(baseUrl?: string | null) {
		if (baseUrl)
			this.baseUrl = baseUrl
	}

	private async getHeaders(auth: boolean): Promise<Record<string, string>> {
		const headers: Record<string, string> = {
			"x-ms-client-principal-name": mockUserName ?? "",
			"x-ms-client-principal-id": mockUserId ?? ""
		}

		if (auth) {
			const accessToken = await getToken()
			if (accessToken) headers["authorization"] = `Bearer ${accessToken}`
		}

		return headers
	}

	public async getModels(): Promise<EmbeddingModel[]> {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/models`
		try {
			const response: Response = await fetch(url, {
				method: 'GET',
				headers: headers
			})
			const details = await response.json()
			return details as EmbeddingModel[]
		} catch (error) {
			return []
		}
	}

	public async getDimensions(model: EmbeddingModel): Promise<EmbeddingDimensions[]> {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/models/${model}/dimensions`
		try {
			const response: Response = await fetch(url, {
				method: 'GET',
				headers: headers
			})
			const details = await response.json()
			return details as EmbeddingDimensions[]
		} catch (error) {
			return []
		}
	}

	public async getStores(): Promise<StoreConfig[]> {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/stores/`
		try {
			const response: Response = await fetch(url, {
				method: 'GET',
				headers: headers
			})
			const details = await response.json()
			return details as StoreConfig[]
		} catch (error) {
			return []
		}
	}

	public async createStore(config: CreateVectorStoreInput): Promise<StoreConfig | null> {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/stores/`
		try {
			const response: Response = await fetch(url, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(config)
			})
			const details = await response.json()
			return details as StoreConfig
		} catch (error) {
			return null
		}
	}

	public async uploadFile(storeId: string, formData: FormData): Promise<Response> {
		const headers = await this.getHeaders(true)
		const response = await fetch(`${this.baseUrl}/api/stores/${storeId}/textfiles`, {
			method: "POST",
			headers: headers,
			body: formData
		})
		return response
	}

	public async deleteStore(id: string): Promise<boolean | null> {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/stores/${id}`

		try {
			const response: Response = await fetch(url, {
				method: 'DELETE',
				headers: headers
			})
			return response.status === 200
		} catch (error) {
			return false
		}
	}


	public async getStore(id: string, extendedInfo: boolean): Promise<StoreResponse | null> {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/stores/${id}`

		try {
			const response: Response = await fetch(url, {
				method: 'GET',
				headers: headers
			})
			const details = await response.json()
			return details as StoreResponse
		} catch (error) {
			return null
		}
	}

	public async getFiles(storeId: string): Promise<VectorStoreFile[]> {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/stores/${storeId}/files`
		try {
			const response: Response = await fetch(url, {
				method: 'GET',
				headers: headers
			})
			const details = await response.json()
			return details as VectorStoreFile[]
		} catch (error) {
			return []
		}
	}

	public async textSearch(storeId: string, query: VectorSearch): Promise<VectorMatch[]> {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/stores/${storeId}/search/text`
		try {
			const response: Response = await fetch(url, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(query)
			})

			const details = await response.json()
			return details as VectorMatch[]
		} catch (error) {
			return []
		}
	}

	public async getAccess(storeId: string) {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/stores/${storeId}/access/`
		try {
			const response: Response = await fetch(url, {
				method: 'GET',
				headers: headers
			})
			const details = await response.json()
			return details as Access
		} catch (error) {
			return {}
		}
	}

	public async setAccess(storeId: string, type: AccessType, userId: string, accessRow: AccessRow) {
		const headers = await this.getHeaders(true)

		if (type === "role") {
			throw Error("Roles are not implmeneted")
		}

		const url = `${this.baseUrl}/api/stores/${storeId}/access/${this.getTypePath(type)}/${userId}`
		try {
			const response: Response = await fetch(url, {
				method: 'PUT',
				headers: headers,
				body: JSON.stringify(accessRow)
			})
			const details = await response.json()
			return details as VectorMatch[]
		} catch (error) {
			return []
		}
	}

	public async removeAccess(storeId: string, type: AccessType, userId: string) {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/stores/${storeId}/access/${this.getTypePath(type)}/${userId}`
		try {
			const response: Response = await fetch(url, {
				method: 'DELETE',
				headers: headers
			})
		} catch (error) {
		}
	}

	public async removeFile(storeId: string, fileId: string) {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/stores/${storeId}/files/${fileId}`
		try {
			const response: Response = await fetch(url, {
				method: 'DELETE',
				headers: headers
			})
		} catch (error) {
		}
	}


	public async searchUsers(query: string): Promise<GraphUser[]> {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/entities/graph/users?search=${encodeURIComponent(query)}`
		try {
			const response: Response = await fetch(url, { method: 'GET', headers })
			return await response.json() as GraphUser[]
		} catch (error) {
			return []
		}
	}

	public async searchGroups(query: string): Promise<GraphGroup[]> {
		const headers = await this.getHeaders(true)
		const url = `${this.baseUrl}/api/entities/graph/groups?search=${encodeURIComponent(query)}`
		try {
			const response: Response = await fetch(url, { method: 'GET', headers })
			return await response.json() as GraphGroup[]
		} catch (error) {
			return []
		}
	}

	private getTypePath( type: AccessType):string {
		if(type==="group")
			return "groups"
		if(type==="user")
			return "users"

		return ""
	}
}