export type RateLimitResult = {
	allowed: boolean
	remaining: number
	// Best-effort ms until the current window rolls over - only meaningful when !allowed, since
	// that's the earliest point count could drop back under the limit.
	retryAfterMs: number
}

// Fixed-window counter, the simplest primitive that's correct under concurrent/multi-instance
// writers as long as the backing store does the increment atomically. "Fixed window" (not sliding)
// means a caller could in theory send `limit` requests right at the end of one window and another
// `limit` right at the start of the next - acceptable here since the limits this backs are already
// generous relative to normal usage; a sliding window buys more precision than this needs.
//
// One interface, swappable backing store - see MongoRateLimiter (today's implementation, no new
// infra) and MockRateLimiter (MOCK_DB=true). Redis (INCR + EXPIRE, or a Lua script for true
// atomicity) maps onto this same shape almost directly if that ever replaces Mongo here - callers
// never see which store is behind getRateLimiter().
export interface IRateLimiter {
	// Atomically increments the counter for `key` within the current fixed window of `windowMs`,
	// and reports whether this request is still within `limit`. Every distinct `key` gets its own
	// independent window/counter - callers namespace keys themselves (see embed/api/chat/+server.ts
	// for the "one key per IP, one key per bot" pattern).
	checkAndIncrement(key: string, limit: number, windowMs: number): Promise<RateLimitResult>
	// The read half of a check-now-record-later budget (see $lib/usagebudget), where the amount to
	// add is only known after the work is done, so it can't be one atomic check-and-increment.
	// Returns the counter for `key` in the current window without changing it - 0 if nothing yet.
	getCount(key: string, windowMs: number): Promise<{ count: number; retryAfterMs: number }>
	// Atomically adds `amount` (may be fractional, e.g. kroner) to `key`'s counter in the current window.
	add(key: string, amount: number, windowMs: number): Promise<void>
}
