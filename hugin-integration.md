# Hugin — SharePoint MCP Integration Guide

**Goal:** Connect Hugin to the SharePoint MCP server so agents can read SharePoint documents.
**MCP server repo:** `telemarkfylke/mcp-sharepoint` (read-only, 7 tools, HTTP transport)
**MCP server local URL:** `http://localhost:8000` (dev) / internal Container App FQDN (prod)
**Protocol:** MCP over HTTP (streamable HTTP transport)

---

## Local development setup

Before touching Hugin code, run the MCP server locally:

```bash
# In the mcp-sharepoint repo
cd /path/to/mcp-sharepoint
source .venv/bin/activate
set -o allexport && source .env && set +o allexport
TRANSPORT=http HTTP_HOST=127.0.0.1 HTTP_PORT=8000 python -m mcp_sharepoint
```

Verify it's running:
```bash
curl http://localhost:8000/health
```

Keep this running while developing Hugin.

---

## MCP client library

Hugin needs an MCP client to talk to the server. Install the official SDK:

```bash
npm install @modelcontextprotocol/sdk
```

---

## What to build in Hugin

The MCP server is **not a new AI vendor** — it's a **tool provider**. Hugin should call the MCP server to fetch SharePoint data, then pass that data as context to the existing AI vendors (OpenAI, Mistral, etc.).

The integration point is the **tool layer**, not the vendor layer.

---

## Step 1 — MCP client wrapper

Create `/src/lib/server/mcp/sharepoint-mcp-client.ts`:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const MCP_SERVER_URL = process.env.MCP_SHAREPOINT_URL ?? 'http://localhost:8000'

let _client: Client | null = null

export async function getMcpClient(): Promise<Client> {
  if (_client) return _client

  const transport = new StreamableHTTPClientTransport(
    new URL(MCP_SERVER_URL)
  )

  _client = new Client(
    { name: 'hugin', version: '1.0.0' },
    { capabilities: {} }
  )

  await _client.connect(transport)
  return _client
}

export async function listSharePointDocuments(folderName = '') {
  const client = await getMcpClient()
  const result = await client.callTool({
    name: 'List_SharePoint_Documents',
    arguments: { folder_name: folderName }
  })
  return result
}

export async function searchSharePoint(query: string, rowLimit = 20) {
  const client = await getMcpClient()
  const result = await client.callTool({
    name: 'Search_SharePoint',
    arguments: { query, row_limit: rowLimit }
  })
  return result
}

export async function getDocumentContent(folderName: string, fileName: string) {
  const client = await getMcpClient()
  const result = await client.callTool({
    name: 'Get_Document_Content',
    arguments: { folder_name: folderName, file_name: fileName }
  })
  return result
}

export async function getSharePointTree(parentFolder = '') {
  const client = await getMcpClient()
  const result = await client.callTool({
    name: 'Get_SharePoint_Tree',
    arguments: { parent_folder: parentFolder }
  })
  return result
}
```

---

## Step 2 — Environment variable

Add to `.env` in Hugin:
```
MCP_SHAREPOINT_URL=http://localhost:8000
```

In production (after Terraform deploy), set this to the Container App internal FQDN:
```
MCP_SHAREPOINT_URL=https://<PREFIX>mcpsharepoint.<internal-fqdn>
```

The internal FQDN comes from the Terraform output `mcp_sharepoint_internal_url` in `lz-terraform`.

---

## Step 3 — API route for SharePoint search

Create `/src/routes/api/sharepoint/search/+server.ts`:

```typescript
import { json } from '@sveltejs/kit'
import { searchSharePoint } from '$lib/server/mcp/sharepoint-mcp-client'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, locals }) => {
  // Reuse Hugin's existing auth — user must be authenticated
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 })

  const query = url.searchParams.get('q')
  if (!query) return json({ error: 'Missing query parameter q' }, { status: 400 })

  const results = await searchSharePoint(query)
  return json(results)
}
```

---

## Step 4 — Pass SharePoint context to AI

The most powerful integration is injecting SharePoint content into the AI conversation as context. In the existing chat flow (`/src/routes/api/chat`), before calling the vendor, check if the agent has SharePoint tools enabled and fetch relevant documents.

Example — add to the chat request handler:

```typescript
// In your chat handler, before calling vendor.createChatResponseStream()
if (chatConfig.tools?.includes('sharepoint_search')) {
  const spResults = await searchSharePoint(userMessage)
  // Prepend SharePoint results as a system message or tool result
  messages.unshift({
    role: 'system',
    content: `Relevant SharePoint documents:\n${JSON.stringify(spResults)}`
  })
}
```

---

## Step 5 — Add to AppConfig (optional, for agent config UI)

If you want SharePoint tools to be configurable per agent in the Hugin admin UI, add to the tools enum in `/src/lib/server/app-config/app-config.ts`:

```typescript
// Add alongside existing "web_search" tool
{ type: 'sharepoint_search' }
{ type: 'sharepoint_get_document' }
```

And add the env var guard so SharePoint tools only appear when the MCP server is configured:
```typescript
sharepoint: Boolean(process.env.MCP_SHAREPOINT_URL)
```

---

## Available MCP tools (reference)

| Tool name | What it does | Key parameters |
|---|---|---|
| `List_SharePoint_Documents` | List files with metadata in a folder | `folder_name` (empty = root) |
| `Search_SharePoint` | Full-text KQL search | `query`, `row_limit` |
| `Get_Document_Content` | Extract text from PDF/Word/Excel | `folder_name`, `file_name` |
| `Get_File_Metadata` | Read SharePoint metadata fields | `folder_name`, `file_name` |
| `List_SharePoint_Folders` | List subfolders | `parent_folder` |
| `Get_SharePoint_Tree` | Recursive folder/file tree | `parent_folder` |
| `Download_Document` | Save file to local filesystem | `folder_name`, `file_name`, `local_path` |

All tools are read-only (`readOnlyHint: true`).

---

## Testing locally end-to-end

1. Start MCP server (see top of this document)
2. Start Hugin dev server: `npm run dev`
3. Test the search endpoint directly:
   ```bash
   curl "http://localhost:5173/api/sharepoint/search?q=budsjett"
   ```
4. Should return SharePoint documents matching the query

---

## Troubleshooting

**`Connection refused` on MCP client connect:**
- MCP server is not running — start it (Step 1 at top)
- Check `MCP_SHAREPOINT_URL` in `.env`

**`401` from MCP server:**
- SharePoint credentials in `.env` of mcp-sharepoint are wrong or expired
- Check `SHP_ID_APP_SECRET` — client secrets expire (30-day rotation in prod)

**Empty results from search:**
- The App Registration may not have `Sites.Read.All` granted yet
- Check Azure Portal → Entra ID → App registrations → `SharePoint MCP - test` → API permissions

**MCP client throws on second request (connection dropped):**
- Add reconnect logic to `getMcpClient()` — wrap in try/catch and reset `_client = null` on error, then retry once

---

## Production checklist

- [ ] `MCP_SHAREPOINT_URL` set to internal Container App FQDN in Hugin app settings (Terraform or Portal)
- [ ] Hugin App Service and Container App are on the same VNet (`tfkdlzchatai-vnet-infra`)
- [ ] SharePoint App Registration has `Sites.Read.All` with admin consent (or `Sites.Selected` for production)
- [ ] Container App is running (check revisions in Portal after `az acr build`)
