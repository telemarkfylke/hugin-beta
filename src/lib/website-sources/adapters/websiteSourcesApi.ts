import type { WebsiteSource, WebsiteSourceInput } from "$lib/types/website-source"

const BASE = "/api/website-sources"

export class WebsiteSourcesApi {
	async getSources(): Promise<WebsiteSource[]> {
		const res = await fetch(BASE)
		if (!res.ok) return []
		return (await res.json()) as WebsiteSource[]
	}

	async createSource(input: WebsiteSourceInput): Promise<WebsiteSource | null> {
		const res = await fetch(BASE, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(input)
		})
		if (!res.ok) return null
		return (await res.json()) as WebsiteSource
	}

	async updateSource(sourceId: string, input: WebsiteSourceInput): Promise<WebsiteSource | null> {
		const res = await fetch(`${BASE}/${sourceId}`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(input)
		})
		if (!res.ok) return null
		return (await res.json()) as WebsiteSource
	}

	async deleteSource(sourceId: string): Promise<boolean> {
		const res = await fetch(`${BASE}/${sourceId}`, { method: "DELETE" })
		return res.ok
	}
}
