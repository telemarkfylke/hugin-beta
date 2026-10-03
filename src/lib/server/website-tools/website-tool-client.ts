import { lookup } from "node:dns/promises"
import { BlockList, isIP } from "node:net"
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
const MAX_REDIRECTS = 5

const TOOL_NAME = "browse_website"

// SSRF guard: any logged-in user can create a website source with any http(s) URL, so the allow-list
// alone says nothing about where the server ends up connecting. Never fetch loopback, private,
// link-local (incl. the Azure metadata endpoint 169.254.169.254), CGNAT, multicast or reserved
// addresses. IPv4-mapped IPv6 (::ffff:*) is blocked wholesale in isBlockedAddress - real public DNS
// never needs it, and it can't be a BlockList rule since BlockList matches every IPv4 address against it.
const BLOCKED_ADDRESSES = new BlockList()
for (const [network, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["224.0.0.0", 4],
	["240.0.0.0", 4]
] as const) {
	BLOCKED_ADDRESSES.addSubnet(network, prefix, "ipv4")
}
for (const [network, prefix] of [
	["::", 128],
	["::1", 128],
	["64:ff9b::", 96],
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8]
] as const) {
	BLOCKED_ADDRESSES.addSubnet(network, prefix, "ipv6")
}

// Everything below is exported for unit testing.

export const isBlockedAddress = (address: string): boolean => {
	const family = isIP(address)
	if (family === 0) return true
	if (family === 6 && /^::ffff:/i.test(address)) return true
	return BLOCKED_ADDRESSES.check(address, family === 4 ? "ipv4" : "ipv6")
}

// Resolves the host and refuses if ANY of its addresses is internal. Checked per request (and per
// redirect hop), not when the source is saved, since DNS can change after saving. Doesn't close DNS
// rebinding between this lookup and fetch's own - that would need a pinned-address HTTP agent.
export const assertPublicHost = async (url: URL): Promise<void> => {
	const hostname = url.hostname.replace(/^\[|\]$/g, "")
	const addresses = isIP(hostname) ? [hostname] : (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address)
	if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
		throw new Error(`«${url.href}» peker til en intern adresse og kan ikke hentes`)
	}
}

// Every URL we connect to - the requested one and each redirect hop - must be http(s), inside the
// allow-list and on a public address. fetch's own redirect following is off, since it would skip this.
const assertFetchable = async (url: URL, entries: WebsiteSourceEntry[]): Promise<void> => {
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("Kun http/https-URL-er støttes")
	}
	if (!isUrlAllowed(url, entries)) {
		throw new Error(`«${url.href}» er ikke blant sidene/prefiksene denne datakilden gir tilgang til`)
	}
	await assertPublicHost(url)
}

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

			logger.info("[website-tool-client] Fetching URL: {url}", url.href)

			const controller = new AbortController()
			const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
			let html: string
			try {
				let res: Response
				for (let hop = 0; ; hop++) {
					await assertFetchable(url, entries)
					res = await fetch(url, { signal: controller.signal, redirect: "manual", headers: { "user-agent": "Hugin/1.0 (+https://telemarkfylke.no)" } })
					const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null
					if (!location) break
					if (hop >= MAX_REDIRECTS) {
						throw new Error("Siden videresender for mange ganger")
					}
					url = new URL(location, url)
				}
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
