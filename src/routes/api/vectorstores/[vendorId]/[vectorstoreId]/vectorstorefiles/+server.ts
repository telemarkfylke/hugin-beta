import { json, type RequestHandler } from "@sveltejs/kit"
import { createVendor } from "$lib/server/agents/vendors"
import { canManageVendorVectorStores, canViewVendorVectorStores } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import type { GetVendorVectorStoreFilesResponse } from "$lib/types/api-responses"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"
import type { VendorId } from "$lib/types/vendor-ids"
import { responseStream } from "$lib/streaming"

const getVendorVectorStoreFiles: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!canViewVendorVectorStores(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to view vendor vector stores`)
	}
	const { vendorId, vectorstoreId } = requestEvent.params
	if (!vendorId || !vectorstoreId) {
		throw new HTTPError(400, "vendorId and vectorstoreId are required")
	}

	const vendor = createVendor(vendorId as VendorId)
	const vectorStoreFiles = await vendor.getVectorStoreFiles(vectorstoreId)

	return {
		response: json(vectorStoreFiles as GetVendorVectorStoreFilesResponse),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getVendorVectorStoreFiles)
}

const uploadVectorStoreFiles: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	/*
	 Det er mulig vi trenger et lokalt datalag med mapping her også for å styre hvem som har rettigheter til hvilke vectorstores, men jeg vet ikke.
	 Det er mulig det bare holder med admin rettigheter for å kunne håndtere alle
	*/
	
	if (!canManageVendorVectorStores(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to view vendor vector stores`)
	}
	const { vendorId, vectorstoreId } = requestEvent.params
	if (!vendorId || !vectorstoreId) {
		throw new HTTPError(400, "vendorId and vectorstoreId are required")
	}

	const body = await requestEvent.request.formData()
	const files: File[] = body.getAll("files[]") as File[]
	const streamParam = body.get("stream")
	if (!streamParam || (streamParam !== "true" && streamParam !== "false")) {
		throw new HTTPError(400, 'stream parameter is required and must be either "true" or "false"')
	}
	const stream: boolean = streamParam === "true"

	// Validate files
	if (!files || files.length === 0) {
		throw new HTTPError(400, "No files provided for upload")
	}

	const vendor = createVendor(vendorId as VendorId)
	const { response } = await vendor.addVectorStoreFiles(vectorstoreId, files, stream)

	
	// Validate each file
	if (!files.every((file) => file instanceof File)) {
		throw new HTTPError(400, "One or more files are not valid File instances")
	}
	if (!files.every((file) => file.type)) {
		throw new HTTPError(400, "One or more files have empty file type")
	}	
	
	// We don't have a agent here. maybee the mimetypes have to be on vendorlevel ? 
	/*	
	if (!files.every((file) => vendor.allowedMimeTypes.vectorStoreFiles.includes(file.type))) {
		throw new HTTPError(400, "One or more files have invalid file type") // Add valid types message senere
	}
	*/

	if (stream) {
		return {
			response: responseStream(response),
			isAuthorized: true
		}
	}
	throw new Error("Non-streaming file upload not implemented yet")
}

export const POST: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, uploadVectorStoreFiles)
}
