import { logger } from "@vestfoldfylke/loglady"
import { convert } from "html-to-text"
import type { WebsiteSourceEntry } from "$lib/types/website-source"
import type { McpClient } from "../mcp/mcp-client"
import type { McpToolDefinition } from "../mcp/mcp-tools"

// Reused as-is from mcp-client.ts's timeout reasoning, just for an ordinary HTTP fetch instead of
// an MCP session - comfortably above what a normal page load should take, still a hard backstop.
const FETCH_TIMEOUT_MS = 20_000
// Raw HTML is capped before conversion, not after - no point spending CPU converting megabytes of
// markup we'd truncate anyway.
const MAX_HTML_CHARS = 2_000_000
const MAX_OUTPUT_CHARS = 20_000
const MAX_LINKS_RETURNED = 30

const TOOL_NAME = "browse_website"

// Everything below is exported for unit testing.

export const describeEntry = (entry: WebsiteSourceEntry): string => (entry.matchType === "exact" ? entry.value : `Alt under ${entry.value}`)

export const buildToolDescription = (entries: WebsiteSourceEntry[]): string => {
	const lines = entries.map((entry) => `- ${describeEntry(entry)}`)
	return [
		"Hent innholdet på en bestemt nettside som ren tekst. Dette er IKKE et generelt websøk - du kan kun hente sider fra denne avgrensede listen (eksakte sider, eller alt under et oppgitt domene/seksjon):",
		...lines,
		"Hvis en hentet side inneholder lenker videre innenfor samme avgrensning, listes de opp nederst i svaret - du kan hente en av dem i et nytt kall for å gå videre."
	].join("\n")
}

// Same host required either way; "exact" additionally requires the exact path+query, "prefix"
// requires the path to start at a segment boundary (so a prefix "/buss" never accidentally matches
// a sibling page like "/bussinfo").
export const isUrlAllowed = (url: URL, entries: WebsiteSourceEntry[]): boolean => {
	return entries.some((entry) => {
		let entryUrl: URL
		try {
			entryUrl = new URL(entry.value)
		} catch {
			return false
		}
		if (url.origin !== entryUrl.origin) return false
		if (entry.matchType === "exact") {
			return url.pathname === entryUrl.pathname && url.search === entryUrl.search
		}
		const prefixPath = entryUrl.pathname.endsWith("/") ? entryUrl.pathname : `${entryUrl.pathname}/`
		return url.pathname === entryUrl.pathname || url.pathname.startsWith(prefixPath)
	})
}

// Deliberately regex-based, not a full HTML parser - good enough to find <a href="..."> targets
// for link discovery, which only needs to be a reasonable approximation (the model can always ask
// again if a link was missed). Errors on the side of finding too little, never too much - a missed
// link is a minor inconvenience, not a scoping problem, since every discovered link is still run
// through isUrlAllowed before being surfaced.
const extractAllowedLinks = (html: string, pageUrl: URL, entries: WebsiteSourceEntry[]): string[] => {
	const found = new Set<string>()
	const hrefPattern = /<a\s[^>]*href\s*=\s*["']([^"'#]+)["']/gi
	let match: RegExpExecArray | null
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec-in-while-loop idiom
	while ((match = hrefPattern.exec(html)) !== null) {
		const href = match[1]
		if (!href) continue
		try {
			const resolved = new URL(href, pageUrl)
			if ((resolved.protocol === "http:" || resolved.protocol === "https:") && isUrlAllowed(resolved, entries)) {
				found.add(resolved.href)
			}
		} catch {
			// Not a resolvable URL (mailto:, javascript:, malformed) - skip it.
		}
		if (found.size >= MAX_LINKS_RETURNED) break
	}
	return [...found]
}

export const createWebsiteToolClient = (entries: WebsiteSourceEntry[]): McpClient => {
	return {
		async listTools(): Promise<McpToolDefinition[]> {
			return [
				{
					name: TOOL_NAME,
					description: buildToolDescription(entries),
					inputSchema: {
						type: "object",
						properties: {
							url: {
								type: "string",
								description: "Full URL til siden som skal hentes - må være en av de tillatte sidene/prefiksene beskrevet i verktøyets beskrivelse."
							}
						},
						required: ["url"]
					}
				}
			]
		},
		async callTool(name: string, args: Record<string, unknown>): Promise<string> {
			if (name !== TOOL_NAME) {
				throw new Error(`Ukjent verktøy: ${name}`)
			}
			const rawUrl = typeof args.url === "string" ? args.url : ""
			let url: URL
			try {
				url = new URL(rawUrl)
			} catch {
				throw new Error(`«${rawUrl}» er ikke en gyldig URL`)
			}
			if (url.protocol !== "http:" && url.protocol !== "https:") {
				throw new Error("Kun http/https-URL-er støttes")
			}
			if (!isUrlAllowed(url, entries)) {
				throw new Error(`«${rawUrl}» er ikke blant sidene/prefiksene denne datakilden gir tilgang til`)
			}

			logger.info("[website-tool-client] Fetching URL: {url}", url.href)

			const controller = new AbortController()
			const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
			let html: string
			try {
				const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": "Hugin/1.0 (+https://telemarkfylke.no)" } })
				if (!res.ok) {
					throw new Error(`Henting av siden feilet (HTTP ${res.status})`)
				}
				const contentType = res.headers.get("content-type") ?? ""
				if (!contentType.includes("html")) {
					throw new Error(`Siden er ikke HTML-innhold (content-type: ${contentType || "ukjent"})`)
				}
				html = await res.text()
			} finally {
				clearTimeout(timeout)
			}
			if (html.length > MAX_HTML_CHARS) {
				html = html.slice(0, MAX_HTML_CHARS)
			}

			const text = convert(html, { wordwrap: false, selectors: [{ selector: "a", options: { ignoreHref: true } }] }).slice(0, MAX_OUTPUT_CHARS)
			const links = extractAllowedLinks(html, url, entries)

			if (links.length === 0) {
				return text
			}
			return `${text}\n\nLenker funnet på denne siden (innenfor tillatt omfang):\n${links.map((link) => `- ${link}`).join("\n")}`
		}
	}
}
