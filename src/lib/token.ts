export const getToken = async (): Promise<string | null> => {
	if (import.meta.env.DEV) {
		return import.meta.env.VITE_RAGSERVICE_TOKEN ?? null
	}
	const res = await fetch('/.auth/me')
	const data = await res.json()
	return data[0]?.access_token ?? null
}
