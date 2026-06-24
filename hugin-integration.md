# SharePoint MCP Server — Hugin Integration Handover

> **Intended audience:** The team rewriting Hugin (or any Node.js/TypeScript service at Telemark fylke).
> This document covers everything needed to integrate the SharePoint MCP server as a tool source.

---

## What this server is

The SharePoint MCP server exposes **7 read-only tools** that give an AI agent access to Telemark fylke's SharePoint document libraries via the Microsoft Graph API.

It is an **MCP (Model Context Protocol) server** — not an LLM. The correct integration pattern is:

```
User prompt
    ↓
Hugin (LLM orchestration)
    ↓  calls tools when needed
SharePoint MCP Server   ← this service
    ↓
Microsoft Graph API → SharePoint
```

The MCP server is a **tool source**. Hugin connects to it as an MCP client, discovers its tools, and calls them when the LLM decides it needs SharePoint data. The LLM itself (OpenAI, Mistral, etc.) stays unchanged.

---

## The 7 available tools

| Tool | What it does | Key input |
|------|-------------|-----------|
| `List_SharePoint_Folders` | List sub-folders at a path | `folder_path` (empty = root) |
| `Get_SharePoint_Tree` | Recursive folder/file hierarchy | `folder_path`, `max_depth` |
| `List_SharePoint_Documents` | List files with metadata | `folder_path` |
| `Search_SharePoint` | Full-text KQL search | `query`, `top` |
| `Get_Document_Content` | Extract text from PDF/Word/Excel | `file_url` |
| `Get_File_Metadata` | All SharePoint metadata fields | `file_url` |
| `Download_Document` | Save file to local filesystem | `file_url`, `save_path` |

All tools are **read-only**. No write operations exist anywhere in the codebase.

---

## Connection details

| Item | Value |
|------|-------|
| MCP server URL | `https://mcp-sharepoint-test.api.telemarkfylke.no/mcp` |
| Health endpoint | `https://mcp-sharepoint-test.api.telemarkfylke.no/health` |
| Transport | Streamable HTTP (MCP 2025-11-25) |
| Authentication | Entra ID Bearer token (Easy Auth) |
| Auth App Registration | `tfkdlzmcpsharepoint-auth` |
| Auth client ID | `6accdec8-ba90-4d48-9b6f-5657f3768593` |
| Token scope | `api://6accdec8-ba90-4d48-9b6f-5657f3768593/.default` |
| Tenant ID | `d64408ee-ce52-4a08-97ff-658c02ccf77b` |
| Required app role | `SharePoint.MCP.Read` |

---

## Getting access

Before Hugin can call the server, the Hugin App Registration needs to be granted access.

**Ask the MCP server owner (tom.jarle.christiansen@telemarkfylke.no) to:**

1. Open `tfkdlzmcpsharepoint-auth` in Entra admin center
2. Grant the Hugin App Registration the `SharePoint.MCP.Read` app role
3. Grant admin consent

This is a one-time setup per service.

---

## Token acquisition (client credentials flow)

Hugin must obtain an Entra ID token before connecting. This uses the **OAuth 2.0 client credentials flow** — no user login required.

### TypeScript example

```typescript
interface TokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

async function getMCPToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<string> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token request failed (${response.status}): ${error}`)
  }

  const data = await response.json() as TokenResponse
  return data.access_token
}

// Usage
const token = await getMCPToken(
  'd64408ee-ce52-4a08-97ff-658c02ccf77b',  // tenant ID
  process.env.MCP_CLIENT_ID!,              // Hugin's client ID
  process.env.MCP_CLIENT_SECRET!,          // Hugin's client secret
  'api://6accdec8-ba90-4d48-9b6f-5657f3768593/.default'
)
```

**Token caching:** Tokens are valid for ~1 hour (`expires_in` seconds). Cache the token and re-fetch only when it expires. Do not request a new token on every MCP call.

---

## Connecting and calling tools (Node.js / TypeScript)

### Install the MCP SDK

```bash
npm install @modelcontextprotocol/sdk
```

### Connect and list tools

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

async function connectToSharePointMCP(bearerToken: string) {
  const transport = new StreamableHTTPClientTransport(
    new URL('https://mcp-sharepoint-test.api.telemarkfylke.no/mcp'),
    {
      requestInit: {
        headers: { Authorization: `Bearer ${bearerToken}` },
      },
    }
  )

  const client = new Client(
    { name: 'hugin', version: '1.0.0' },
    { capabilities: {} }
  )

  await client.connect(transport)
  return client
}

// List available tools
const client = await connectToSharePointMCP(token)
const { tools } = await client.listTools()
console.log(tools.map(t => t.name))
// ['List_SharePoint_Folders', 'Get_SharePoint_Tree', ...]
```

### Call a tool

```typescript
// List folders at root
const result = await client.callTool({
  name: 'List_SharePoint_Folders',
  arguments: { folder_path: '' },
})

// Search for documents
const searchResult = await client.callTool({
  name: 'Search_SharePoint',
  arguments: { query: 'budsjett 2025', top: 5 },
})

// Get document text content
const content = await client.callTool({
  name: 'Get_Document_Content',
  arguments: { file_url: 'https://telemarkfylke.sharepoint.com/...' },
})
```

Tool results are returned as `content[].text` (JSON strings).

---

## How this fits into Hugin's architecture

MCP tools are not a vendor replacement — they extend what the LLM can do. The integration pattern depends on which LLM provider is in use:

### OpenAI / LiteLLM (tool_calls)

OpenAI's API supports function/tool calling natively. The flow is:

1. On startup, fetch the tool list from the MCP server: `client.listTools()`
2. Convert MCP tool definitions to OpenAI tool format and include them in every chat request
3. When the LLM responds with a `tool_calls` entry, call the corresponding MCP tool
4. Return the tool result to the LLM as a `tool` role message
5. Continue until the LLM produces a final text response

```typescript
// Convert MCP tool definition to OpenAI format
function mcpToolToOpenAITool(mcpTool: Tool): ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: mcpTool.name,
      description: mcpTool.description ?? '',
      parameters: mcpTool.inputSchema,
    },
  }
}

// Agentic loop
async function chatWithSharePointTools(messages: ChatMessage[], token: string) {
  const mcpClient = await connectToSharePointMCP(token)
  const { tools } = await mcpClient.listTools()
  const openAITools = tools.map(mcpToolToOpenAITool)

  while (true) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: openAITools,
    })

    const choice = response.choices[0]

    if (choice.finish_reason === 'stop') {
      return choice.message.content  // Final answer
    }

    if (choice.finish_reason === 'tool_calls') {
      // Execute each tool call
      for (const toolCall of choice.message.tool_calls ?? []) {
        const args = JSON.parse(toolCall.function.arguments)
        const result = await mcpClient.callTool({
          name: toolCall.function.name,
          arguments: args,
        })

        messages.push({ role: 'assistant', ...choice.message })
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result.content[0].text,
        })
      }
    }
  }
}
```

### Mistral / other providers

Same pattern — convert MCP tool definitions to the provider's tool format, handle tool call responses, loop until completion. Each provider has slightly different field names but the same concept.

---

## Environment variables for Hugin

Add these to Hugin's `.env` / App Service configuration:

```bash
# SharePoint MCP Server
MCP_SHAREPOINT_URL=https://mcp-sharepoint-test.api.telemarkfylke.no/mcp
MCP_SHAREPOINT_CLIENT_ID=<hugin-app-registration-client-id>
MCP_SHAREPOINT_CLIENT_SECRET=<hugin-app-registration-client-secret>
MCP_SHAREPOINT_TENANT_ID=d64408ee-ce52-4a08-97ff-658c02ccf77b
MCP_SHAREPOINT_SCOPE=api://6accdec8-ba90-4d48-9b6f-5657f3768593/.default
MCP_SHAREPOINT_ENABLED=true
```

---

## Verified working (Python reference)

This integration was verified end-to-end on 2026-06-23 using the Python MCP SDK:

```python
import asyncio, requests
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

TOKEN_URL = "https://login.microsoftonline.com/d64408ee-ce52-4a08-97ff-658c02ccf77b/oauth2/v2.0/token"
MCP_URL   = "https://mcp-sharepoint-test.api.telemarkfylke.no/mcp"

def get_token(client_id, client_secret, scope):
    resp = requests.post(TOKEN_URL, data={
        "client_id": client_id, "client_secret": client_secret,
        "scope": scope, "grant_type": "client_credentials",
    }, timeout=15)
    resp.raise_for_status()
    return resp.json()["access_token"]

async def main():
    token = get_token("<client-id>", "<secret>",
                      "api://6accdec8-ba90-4d48-9b6f-5657f3768593/.default")

    async with streamablehttp_client(MCP_URL,
                headers={"Authorization": f"Bearer {token}"}) as (r, w, _):
        async with ClientSession(r, w) as session:
            await session.initialize()
            tools = await session.list_tools()
            print([t.name for t in tools.tools])  # 7 tools
            result = await session.call_tool("List_SharePoint_Folders", {"folder_path": ""})
            print(result.content[0].text)          # Real SharePoint folders

asyncio.run(main())
```

Result: 7 tools returned, real SharePoint folder list returned. Full stack confirmed working.

---

## Known limitations

| Issue | Impact | Status |
|-------|--------|--------|
| Auth client secret expires in 180 days | Server goes down if not rotated | Rotate `tfkdlzmcpsharepoint-auth` secret before Dec 2026 |
| No fine-grained per-tool authorization | Any granted service can call all 7 tools | Acceptable for internal org use |
| `/health` requires Bearer token | Front Door health probe fails without exclusion | Fix: `az webapp auth update --excluded-paths "/health"` |
| `Sites.Read.All` permission in use | Broader than necessary | Future: switch to `Sites.Selected` |

---

## Contact

MCP server owner: **Tom Jarle Christiansen** (tom.jarle.christiansen@telemarkfylke.no)

For access requests, architecture questions, or incident response.
