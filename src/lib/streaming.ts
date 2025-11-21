import { MuginSse } from "./types/streaming.js"

export const responseStream = (stream: ReadableStream<Uint8Array>): Response => {
	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no"
		}
	})
}

/*
SSE format:
Server-Sent Event (SSE) messages are formatted as a simple stream of UTF-8 text data, with events separated by two newline characters (\n\n).
Each event can contain fields like data (the message payload), event (an event type), id (a unique event ID), and retry (reconnection time).
The server sends this stream over a persistent HTTP connection with a Content-Type of text/event-stream
*/
const textEncoder = new TextEncoder()

export const createSse = (muginEvent: MuginSse): Uint8Array<ArrayBuffer> => {
	try {
		muginEvent = MuginSse.parse(muginEvent) // Validate event type
		return textEncoder.encode(`event: ${muginEvent.event}\ndata: ${JSON.stringify(muginEvent.data)}\n\n`)
	} catch (error) {
		console.error("Error creating SSE:", error, "for event:", muginEvent)
		throw error
	}
}

// Frontend parse dritten
/**
 * @description EventSource doesnt support POST requests, so we need to parse the SSE text manually (until some smart person sees this...)
 */
export const parseSse = (chunk: string): MuginSse[] => {
	if (typeof chunk !== "string" && !chunk) throw new Error("No chunk (string) provided for parsing SSE")
	if (chunk.length === 0) return [] // Return empty array for empty chunk
	if (!chunk.endsWith("\n\n")) {
		throw new Error("Invalid SSE format - chunk must end with two newlines")
	}
	const eventLines = chunk.split("\n\n")
	const result: MuginSse[] = []
	for (const line of eventLines) {
		if (line.length === 0) continue // Skip empty lines
		const keyValueLines = line.split("\n")
		if (keyValueLines.length !== 2) {
			throw new Error("Invalid SSE format - must contain exactly two lines per event (event and data)")
		}
		if (!keyValueLines[0] || !keyValueLines[0].startsWith("event: ")) {
			throw new Error(`Invalid line (does not start with event:) ${keyValueLines[0]}`)
		}
		if (!keyValueLines[1] || !keyValueLines[1].startsWith("data: ")) {
			throw new Error(`Invalid line (does not start with data:) ${keyValueLines[1]}`)
		}
		const event = keyValueLines[0].slice(7).trim()
		const data = JSON.parse(keyValueLines[1].slice(6).trim()) // Remove 'data: ' prefix, and parse JSON
		result.push(MuginSse.parse({ event, data }))
	}
	return result
}
