import type { ObjectId } from "mongodb"

export type DocumentLibraryMapping = {
	_id: ObjectId
	libraryIds: Record<string, string[]>
}
