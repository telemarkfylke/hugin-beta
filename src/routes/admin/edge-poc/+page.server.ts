// TEMPORARY: proof of concept that Hugin (in Azure) reaches Traefik on edge-01 (on-prem) over HTTPS
// with a publicly trusted Let's Encrypt certificate. Remove once real traffic goes through edge-01.
// ClickUp: https://app.clickup.com/t/86cba2j8e
import { lookup } from "node:dns/promises"
import { request } from "node:https"
import { isIPv4 } from "node:net"
import { connect, type DetailedPeerCertificate } from "node:tls"
import { error } from "@sveltejs/kit"
import { env } from "$env/dynamic/private"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "$lib/server/auth/auth-constants"
import { getPrincipalClaims } from "$lib/server/auth/get-authenticated-user"
import type { PageServerLoad } from "./$types"

const EDGE_HOST = "ki.telemarkfylke.no"
const TIMEOUT_MS = 5000

type Step = { ok: boolean; ms: number; detail: string }

type CertInfo = {
	subject: string
	altNames: string[]
	issuer: string
	validFrom: string
	validTo: string
	daysLeft: number
	chain: string[]
}

export type EdgePocResult = {
	host: string
	targetIp: string | null
	ipSource: "query" | "dns" | null
	dns: Step & { addresses: string[] }
	tls: (Step & { authorized: boolean; protocol: string | null; cipher: string | null; cert: CertInfo | null }) | null
	http: (Step & { status: number | null; server: string | null }) | null
	checkedAt: string
}

// Only private IPv4 addresses may be passed in ?ip=, so this admin page can't be used to probe arbitrary hosts.
const isPrivateIPv4 = (ip: string): boolean => {
	if (!isIPv4(ip)) return false
	const [a = 0, b = 0] = ip.split(".").map(Number)
	return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

const requireAdmin = (request: Request): void => {
	const adminRole = env.APP_ROLE_ADMIN
	const claimsHeader = request.headers.get(MS_AUTH_PRINCIPAL_CLAIMS_HEADER)
	if (!adminRole || !claimsHeader) {
		error(401, "Missing claims in request headers")
	}
	const userClaims = getPrincipalClaims(claimsHeader)
	const roles = userClaims?.claims?.filter((claim) => claim.typ === "roles").map((claim) => claim.val) ?? []
	if (!roles.includes(adminRole)) {
		error(403, "User does not have admin role, access forbidden")
	}
}

const errorMessage = (err: unknown): string => {
	if (err instanceof Error) {
		const code = (err as NodeJS.ErrnoException).code
		return code ? `${code}: ${err.message}` : err.message
	}
	return String(err)
}

const checkDns = async (): Promise<EdgePocResult["dns"]> => {
	const start = performance.now()
	try {
		const results = await lookup(EDGE_HOST, { all: true, family: 4 })
		const addresses = results.map((result) => result.address)
		return { ok: true, ms: performance.now() - start, detail: addresses.join(", "), addresses }
	} catch (err) {
		return { ok: false, ms: performance.now() - start, detail: errorMessage(err), addresses: [] }
	}
}

// Certificate name fields are typed string | string[] because a field may repeat.
const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value)

const describeCert = (cert: DetailedPeerCertificate): CertInfo => {
	const chain: string[] = []
	let current: DetailedPeerCertificate | undefined = cert
	// The root certificate is its own issuer, which is where the walk stops.
	while (current && chain.length < 5) {
		chain.push(first(current.subject?.CN) ?? first(current.subject?.O) ?? "ukjent")
		if (!current.issuerCertificate || current.issuerCertificate === current) break
		current = current.issuerCertificate
	}
	const validTo = new Date(cert.valid_to)
	return {
		subject: first(cert.subject?.CN) ?? "",
		altNames: (cert.subjectaltname ?? "")
			.split(",")
			.map((name) => name.trim().replace(/^DNS:/, ""))
			.filter(Boolean),
		issuer: [first(cert.issuer?.O), first(cert.issuer?.CN)].filter(Boolean).join(", "),
		validFrom: new Date(cert.valid_from).toISOString(),
		validTo: validTo.toISOString(),
		daysLeft: Math.floor((validTo.getTime() - Date.now()) / 86_400_000),
		chain
	}
}

// Connects to the IP but presents EDGE_HOST as the server name, the same way a client that resolved the name would.
// rejectUnauthorized is off so an untrusted certificate is reported instead of thrown; trust is shown by `authorized`.
const checkTls = (ip: string): Promise<NonNullable<EdgePocResult["tls"]>> =>
	new Promise((resolve) => {
		const start = performance.now()
		let tcpMs = 0
		const socket = connect({ host: ip, port: 443, servername: EDGE_HOST, rejectUnauthorized: false, timeout: TIMEOUT_MS })
		const fail = (detail: string) => {
			socket.destroy()
			resolve({ ok: false, ms: performance.now() - start, detail, authorized: false, protocol: null, cipher: null, cert: null })
		}
		socket.once("connect", () => {
			tcpMs = performance.now() - start
		})
		socket.once("secureConnect", () => {
			const tlsMs = performance.now() - start
			const authorized = socket.authorized
			const detail = authorized ? `TCP ${tcpMs.toFixed(0)} ms, TLS ferdig etter ${tlsMs.toFixed(0)} ms` : `Sertifikatet er ikke klarert: ${String(socket.authorizationError)}`
			const result = {
				ok: authorized,
				ms: tlsMs,
				detail,
				authorized,
				protocol: socket.getProtocol(),
				cipher: socket.getCipher()?.name ?? null,
				cert: describeCert(socket.getPeerCertificate(true))
			}
			socket.end()
			resolve(result)
		})
		socket.once("timeout", () => fail(`Tidsavbrudd etter ${TIMEOUT_MS} ms${tcpMs ? " (TCP koblet, TLS svarte ikke)" : " (ingen TCP-forbindelse)"}`))
		socket.once("error", (err) => fail(errorMessage(err)))
	})

// A real HTTPS request with full certificate verification, pinned to the IP through a custom lookup.
const checkHttp = (ip: string): Promise<NonNullable<EdgePocResult["http"]>> =>
	new Promise((resolve) => {
		const start = performance.now()
		const req = request(
			{
				host: EDGE_HOST,
				port: 443,
				path: "/",
				method: "GET",
				timeout: TIMEOUT_MS,
				lookup: (_hostname, _options, callback) => callback(null, [{ address: ip, family: 4 }])
			},
			(res) => {
				res.resume()
				// Traefik answers 404 for a name it has no route for. Any response proves the full chain works.
				resolve({
					ok: true,
					ms: performance.now() - start,
					detail: `HTTP ${res.statusCode}${res.statusCode === 404 ? " (ingen rute for navnet ennå, forventet)" : ""}`,
					status: res.statusCode ?? null,
					server: (res.headers.server as string | undefined) ?? null
				})
			}
		)
		req.once("timeout", () => req.destroy(new Error(`Tidsavbrudd etter ${TIMEOUT_MS} ms`)))
		req.once("error", (err) => resolve({ ok: false, ms: performance.now() - start, detail: errorMessage(err), status: null, server: null }))
		req.end()
	})

export const load: PageServerLoad = async ({ request, url }): Promise<{ result: EdgePocResult }> => {
	requireAdmin(request)

	const dns = await checkDns()
	const ipParam = url.searchParams.get("ip")
	const queryIp = ipParam && isPrivateIPv4(ipParam) ? ipParam : null
	const targetIp = queryIp ?? dns.addresses[0] ?? null

	const result: EdgePocResult = {
		host: EDGE_HOST,
		targetIp,
		ipSource: queryIp ? "query" : targetIp ? "dns" : null,
		dns,
		tls: targetIp ? await checkTls(targetIp) : null,
		http: targetIp ? await checkHttp(targetIp) : null,
		checkedAt: new Date().toISOString()
	}
	return { result }
}
