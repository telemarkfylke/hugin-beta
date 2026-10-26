import { env } from "$env/dynamic/private"

// BLOCKED_USERS: comma-separated Entra object ids and/or UPNs (preferred_username), case-insensitive.
// Changing it in App Service config takes effect on the restart that triggers - no deploy needed.
const getBlockedUsers = (): string[] =>
	(env.BLOCKED_USERS ?? "")
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean)

export const isUserBlocked = (userId: string, preferredUserName: string): boolean => {
	const blockedUsers = getBlockedUsers()
	return blockedUsers.includes(userId.toLowerCase()) || blockedUsers.includes(preferredUserName.toLowerCase())
}
