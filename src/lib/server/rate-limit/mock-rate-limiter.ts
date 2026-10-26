import type { IRateLimiter, RateLimitResult } from "./interface"

// In-memory equivalent of MongoRateLimiter, for MOCK_DB=true (local dev/tests) - same fixed-window
// semantics, just a Map instead of a collection. Per-process only, which is fine for a single mock
// server instance; never use this where the app runs as more than one instance.
export class MockRateLimiter implements IRateLimiter {
	private readonly windows = new Map<string, { windowStart: number; count: number }>()

	async checkAndIncrement(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
		const now = Date.now()
		const windowStart = Math.floor(now / windowMs) * windowMs
		const windowEnd = windowStart + windowMs

		const existing = this.windows.get(key)
		const count = existing && existing.windowStart === windowStart ? existing.count + 1 : 1
		this.windows.set(key, { windowStart, count })

		return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterMs: windowEnd - now }
	}

	async getCount(key: string, windowMs: number): Promise<{ count: number; retryAfterMs: number }> {
		const now = Date.now()
		const windowStart = Math.floor(now / windowMs) * windowMs
		const existing = this.windows.get(key)
		return { count: existing && existing.windowStart === windowStart ? existing.count : 0, retryAfterMs: windowStart + windowMs - now }
	}

	async add(key: string, amount: number, windowMs: number): Promise<void> {
		const windowStart = Math.floor(Date.now() / windowMs) * windowMs
		const existing = this.windows.get(key)
		const count = existing && existing.windowStart === windowStart ? existing.count + amount : amount
		this.windows.set(key, { windowStart, count })
	}
}
