import { HTTPError } from "$lib/server/middleware/http-error"

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/

export const isValidObjectId = (value: string): boolean => OBJECT_ID_REGEX.test(value)

export const assertValidObjectId = (value: string, fieldName = "id"): void => {
	if (!isValidObjectId(value)) {
		throw new HTTPError(400, `${fieldName} must be a valid ObjectId`)
	}
}
