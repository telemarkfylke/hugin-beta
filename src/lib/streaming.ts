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

const parseSseEventBlock = (block: string): MuginSse => {
	const keyValueLines = block.split("\n")
	if (keyValueLines.length !== 2) {
		throw new Error("Invalid SSE format - must contain exactly two lines per event (event and data)")
	}
	if (!keyValueLines[0]?.startsWith("event: ")) {
		throw new Error(`Invalid line (does not start with event:) ${keyValueLines[0]}`)
	}
	if (!keyValueLines[1]?.startsWith("data: ")) {
		throw new Error(`Invalid line (does not start with data:) ${keyValueLines[1]}`)
	}
	const event = keyValueLines[0].slice(7).trim()
	const data = JSON.parse(keyValueLines[1].slice(6).trim())
	return MuginSse.parse({ event, data })
}

export type SseParser = {
	push(chunk: string): MuginSse[]
	flush(): MuginSse[]
}

/**
 * Parses SSE text incrementally. HTTP stream chunks are arbitrary and may split events,
 * so callers should keep one parser instance for the whole response body.
 */
export const createSseParser = (): SseParser => {
	let buffer = ""
	return {
		push(chunk: string): MuginSse[] {
			if (typeof chunk !== "string") throw new Error("No chunk (string) provided for parsing SSE")
			if (chunk.length === 0) return []
			buffer += chunk
			const result: MuginSse[] = []
			let separatorIndex = buffer.indexOf("\n\n")
			while (separatorIndex !== -1) {
				const block = buffer.slice(0, separatorIndex)
				buffer = buffer.slice(separatorIndex + 2)
				if (block.length > 0) {
					result.push(parseSseEventBlock(block))
				}
				separatorIndex = buffer.indexOf("\n\n")
			}
			return result
		},
		flush(): MuginSse[] {
			if (buffer.length === 0) return []
			throw new Error("Invalid SSE format - stream ended with an incomplete event")
		}
	}
}

/**
 * @description Convenience parser for complete SSE chunks. For network streams, use createSseParser().
 */
export const parseSse = (chunk: string): MuginSse[] => {
	const parser = createSseParser()
	const result = parser.push(chunk)
	parser.flush()
	return result
}
