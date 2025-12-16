export class HTTPError extends Error {
	status: number
	data?: unknown
	constructor(status: number, message: string, data?: unknown) {
		super(message)
		this.status = status
		this.name = "HTTPError"
		this.data = data
	}
}
