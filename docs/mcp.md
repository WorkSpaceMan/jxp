# MCP (Model Context Protocol)

JXP can expose a **read-only** MCP server on the same HTTP port as the REST API. This lets AI clients (Cursor, LM Studio, RevEngine2 admin proxy) query your data with the same permissions as the REST API.

## Enable

```bash
MCP_ENABLED=true
```

Optional settings (all prefixed `MCP_`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `MCP_PATH` | `/mcp` | HTTP endpoint |
| `MCP_REQUIRE_API_KEY` | `true` | Reject unauthenticated MCP |
| `MCP_MODEL_WHITELIST` | _(empty)_ | Expose default-hidden models (e.g. `user`) |
| `MCP_MODEL_BLACKLIST` | _(empty)_ | Always hide models |
| `MCP_DEFAULT_HIDDEN_MODELS` | builtin auth slugs | Override default-deny list |
| `MCP_DEFAULT_LIMIT` | `20` | Default row limit |
| `MCP_MAX_LIMIT` | `100` | Hard cap on `limit` |
| `MCP_MAX_RESPONSE_SIZE` | `256kb` | JSON response cap |
| `MCP_MAX_CSV_SIZE` | `512kb` | CSV export cap |
| `MCP_TRUNCATE_STRINGS_AT` | `4000` | Truncate long string fields in JSON |
| `MCP_DISABLE_AUTOPOPULATE` | `true` | Ignore expensive autopopulate |
| `MCP_INSTRUCTIONS_APPEND` | _(empty)_ | Text appended to server instructions (initialize) |
| `MCP_GUIDE_FILES` | _(empty)_ | Comma-separated markdown files merged into `jxp-guide` resource |

## LLM guidance

On connect, the MCP `initialize` response includes **server instructions** — a short workflow summary injected for the LLM.

For the full guide, read the fixed MCP resource **`jxp-guide`** (`jxp://guide`, markdown). Content is merged in order:

1. Built-in [`default.md`](https://github.com/WorkSpaceMan/jxp/blob/main/src/libs/mcp/guides/default.md)
2. `JXPConfig.mcp.guideFiles` (app config)
3. `MCP_GUIDE_FILES` (env)

### App extension (`JXPConfig.mcp`)

```typescript
apiconfig.mcp = {
  instructions: "Short app-specific note appended to server instructions.",
  guideFiles: [path.join(__dirname, "../../mcp/guide.md")],
};
```

Example: [revengine-api `mcp/guide.md`](https://github.com/WorkSpaceMan/revengine-api) adds domain context for `reader`, `segment`, etc.

## Tools (fixed)

1. **`jxp_list_models`** — models the caller can read via MCP
2. **`jxp_describe_model`** — field types, links, populate hints
3. **`jxp_find`** — list or get by `id`; supports `filter`, `search`, `populate`, `fields`, `sort`, `limit`, `page`
4. **`jxp_count`** — count with optional `filter` / `search`
5. **`jxp_export_csv`** — CSV text export (use `fields` + low `limit`)

Tools never change when you add models — agents call `jxp_list_models` first.

## Authentication

Send the user's API key on every MCP HTTP request:

```
X-API-Key: <apikey>
```

Bearer tokens also work. MCP uses the same permission rules as `GET /api/:model`.

## Docs playground

When `MCP_ENABLED=true`, the built-in docs UI includes **`/docs/mcp`** — a chat-style assistant that calls the same five MCP tools (protected by the same login as **Browse API**). Use the API key field in the top bar or sign in; tool calls go through `POST /docs/mcp/call` with your permissions.

Default-hidden models (unless whitelisted): built-in auth collections (`user`, `apikey`, `token`, etc.) and schemas with `internal: true`.

## Cursor / LM Studio (stdio)

Use the `jxp-mcp` bridge (proxies stdio → HTTP, including tools, resources, and instructions):

```json
{
  "mcpServers": {
    "jxp": {
      "command": "npx",
      "args": ["-y", "jxp-mcp"],
      "env": {
        "JXP_URL": "http://localhost:4001",
        "JXP_API_KEY": "your-api-key"
      }
    }
  }
}
```

For Cursor, direct HTTP MCP also works and receives instructions automatically:

```json
{
  "mcpServers": {
    "jxp": {
      "url": "http://localhost:4001/mcp",
      "headers": { "X-API-Key": "your-api-key" }
    }
  }
}
```

## RevEngine2 / server proxy

Backend connects to `{API_URL}/mcp` with the logged-in user's API key and proxies MCP between the admin UI and JXP. JXP's own docs UI also exposes `/docs/mcp` for local exploration.

## Deploying `jxp-mcp`

`jxp-mcp` is **not** a separate npm package. It ships as a **CLI binary on the `jxp` package** (since v5.0.0):

```bash
npm install jxp@5          # or depend on jxp in your app
npx jxp-mcp                # stdio MCP → your HTTP /mcp endpoint
```

| Component | Where it runs | Role |
|-----------|---------------|------|
| **JXP HTTP API** | Your server (e.g. RevEngine Docker on port 4001) | Serves REST + `/mcp` when `MCP_ENABLED=true` |
| **`jxp-mcp` bridge** | Developer's machine (Cursor, LM Studio) | stdio proxy; needs `JXP_URL` + `JXP_API_KEY` pointing at the HTTP server |

**Production API containers** do not need to run `jxp-mcp`. Enable MCP on the API (`MCP_ENABLED=true`) and connect from the IDE via HTTP or stdio.

**Publish order:** `npm publish` **jxp@5** first, then bump app dependencies (e.g. `revengine-api` `jxp: ^5.0.0`) and rebuild Docker images.

## v1 limitations

- Read-only (no mutations)
- No `POST /query`, `/aggregate`, or `/call`
- No per-model `mcp:` schema flag (env lists only)
