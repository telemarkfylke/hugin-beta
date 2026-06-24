import type { AccessFlat, AccessLevel, AccessRow, StoreWrapper } from "./types"

export function flattenAccesses(input: Record<string, AccessRow>, type: "user" | "group" | "role"): AccessFlat[] {
	const reply: AccessFlat[] = []
	for (const key of Object.keys(input)) {
		// biome-ignore lint/style/noNonNullAssertion: key comes from Object.keys(input), guaranteed to exist
		const access: AccessRow = input[key]!
		reply.push({ ...access, id: key, type: type })
	}

	return reply
}

export function checkAccess(store: StoreWrapper, userId: string, type: AccessLevel): boolean {
	if (!store || !userId) return false

	if (store.config.createdBy.id === userId) return true

	if (!store.access.users) return false

	if (store.access.users[userId]?.[type] === true) return true

	return false
}
