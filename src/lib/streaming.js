// Trenger en felles måte å håndtere streaming. Både i frontend (ta i mot streamen) og backend (lage streamen fra leverandør)

import z from "zod";

// Backend: Ta i mot stream fra leverandør og pakk det inn i en ReadableStream som SvelteKit kan sende til frontend

// SSE format:
// Server-Sent Event (SSE) messages are formatted as a simple stream of UTF-8 text data, with events separated by two newline characters (\n\n).
// Each event can contain fields like data (the message payload), event (an event type), id (a unique event ID), and retry (reconnection time).
// The server sends this stream over a persistent HTTP connection with a Content-Type of text/event-stream

const muginEvents = ['conversation.started', 'message.delta', 'conversation.ended', 'error'];
const textEncoder = new TextEncoder();

/**
 * 
 * @param {'conversation.started' | 'message.delta' | 'conversation.ended' | 'error'} event 
 * @param {*} data 
 * @returns {Uint8Array<ArrayBuffer>}
 */
export const createSse = (event, data) => {
  if (!muginEvents.includes(event)) {
    throw new Error(`Unsupported event type: ${event}`);
  }
  return textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const EventTypes = z.enum(['conversation.started', 'message.delta', 'conversation.ended', 'error']);


// Frontend parse dritten
/**
   * @description EventSource doesnt support POST requests, so we need to parse the SSE text manually (until some smart person sees this...)
   * @param {string} chunk
   */
export const parseSse = (chunk) => {
  if (typeof chunk !== 'string' && !chunk) throw new Error("No chunk (string) provided for parsing SSE")
  if (!chunk.endsWith('\n\n')) {
    throw new Error("Invalid SSE format - chunk must end with two newlines")
  }
  const eventLines = chunk.split('\n\n');
  const result = []
  for (const line of eventLines) {
    if (line.length === 0) continue // Skip empty lines
    const keyValueLines = line.split('\n')
    if (keyValueLines.length !== 2) {
      throw new Error("Invalid SSE format - must contain exactly two lines per event (event and data)")
    }
    const event = keyValueLines[0].slice(7).trim()
    if (!muginEvents.includes(event)) {
      throw new Error(`Unsupported event type: ${event}`);
    }
    if (!keyValueLines[1].startsWith('data: ')) {
      throw new Error(`Invalid line (does not start with data:) ${keyValueLines[1]}`);
    }
    const data = JSON.parse(keyValueLines[1].slice(6).trim()) // Remove 'data: ' prefix, and parse JSON
    result.push({ event, data });
  }
  return result
}

/*
export const parseSseMessage = (chunk) => {
  const text = new TextDecoder().decode(chunk);
  const lines = text.split(/\r\n|\r|\n/);
  const dataLines: string[] = [];
  const ret: ServerEvent<string> = {};
  let ignore = true;
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    ignore = false;
    const i = line.indexOf(":");
    const field = line.slice(0, i);
    const value = line[i + 1] === " " ? line.slice(i + 2) : line.slice(i + 1);
    if (field === "data") dataLines.push(value);
    else if (field === "event") ret.event = value;
    else if (field === "id") ret.id = value;
    else if (field === "retry") {
      const n = Number(value);
      if (!isNaN(n)) ret.retry = n;
    }
  }
  if (ignore) return;
  if (dataLines.length) ret.data = dataLines.join("\n");
  return parse(ret);
}
*/