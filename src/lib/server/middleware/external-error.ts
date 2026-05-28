import { logger } from "@vestfoldfylke/loglady"
import { HTTPError } from "./http-error"

type ErrorLikeWithStatus = Error & {
	status?: unknown
	statusCode?: unknown
	body?: unknown
}

const isErrorLikeWithStatus = (error: unknown): error is ErrorLikeWithStatus => error instanceof Error

const providerStatusToHttpStatus = (status: number): number => {
	if (status === 400 || status === 413 || status === 415 || status === 429) return status
	if (status === 401 || status === 403) return 502
	if (status >= 400 && status < 500) return 400
	return 502
}

export const externalErrorToHTTPError = (error: unknown, providerName: string): HTTPError | null => {
	if (!isErrorLikeWithStatus(error)) return null
	const status = typeof error.statusCode === "number" ? error.statusCode : typeof error.status === "number" ? error.status : null
	if (!status) return null

	const isLikelySizeError = status === 413 || /too large|payload|file size|request entity/i.test(error.message)
	const httpStatus = isLikelySizeError ? 413 : providerStatusToHttpStatus(status)
	const message = isLikelySizeError ? `${providerName} rejected the request because the uploaded file or request body is too large` : `${providerName} rejected the request`

	// Log detailed error server-side only — do not include in client response
	logger.warn(`[externalErrorToHTTPError] ${providerName} error ${status}: ${error.message}`)

	return new HTTPError(httpStatus, message, {
		provider: providerName,
		providerStatus: status
	})
}
