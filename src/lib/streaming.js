import { MuginEventTypes, MuginSse } from "./types/streaming.js";

/*
SSE format:
Server-Sent Event (SSE) messages are formatted as a simple stream of UTF-8 text data, with events separated by two newline characters (\n\n).
Each event can contain fields like data (the message payload), event (an event type), id (a unique event ID), and retry (reconnection time).
The server sends this stream over a persistent HTTP connection with a Content-Type of text/event-stream
*/
const textEncoder = new TextEncoder();

/**
 * 
 * @param {MuginEventTypes} event 
 * @param {*} data 
 * @returns {Uint8Array<ArrayBuffer>}
 */
export const createSse = (event, data) => {
  event = MuginEventTypes.parse(event); // Validate event type
  return textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Frontend parse dritten
/**
 * @description EventSource doesnt support POST requests, so we need to parse the SSE text manually (until some smart person sees this...)
 * @param {string} chunk
 * @returns {MuginSse[]} Array of parsed SSE events
 */
export const parseSse = (chunk) => {
  if (typeof chunk !== 'string' && !chunk) throw new Error("No chunk (string) provided for parsing SSE")
  console.log("Parsing SSE chunk:", chunk)
  if (chunk.length === 0) return [] // Return empty array for empty chunk
  if (!chunk.endsWith('\n\n')) {
    throw new Error("Invalid SSE format - chunk must end with two newlines")
  }
  const eventLines = chunk.split('\n\n');
  /** @type {MuginSse[]} */
  const result = []
  for (const line of eventLines) {
    if (line.length === 0) continue // Skip empty lines
    const keyValueLines = line.split('\n')
    if (keyValueLines.length !== 2) {
      throw new Error("Invalid SSE format - must contain exactly two lines per event (event and data)")
    }
    const event = MuginEventTypes.parse(keyValueLines[0].slice(7).trim())
    if (!keyValueLines[1].startsWith('data: ')) {
      throw new Error(`Invalid line (does not start with data:) ${keyValueLines[1]}`);
    }
    const data = JSON.parse(keyValueLines[1].slice(6).trim()) // Remove 'data: ' prefix, and parse JSON
    result.push({ event, data });
  }
  return result
}
