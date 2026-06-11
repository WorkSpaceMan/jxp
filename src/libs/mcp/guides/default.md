# JXP MCP usage guide

Read-only access to JXP REST data via five fixed tools. Permissions match the authenticated user's API key.

## Workflow

1. **`jxp_list_models`** — discover model slugs available to this caller.
2. **`jxp_describe_model`** — field types, indexed/filterable fields, link/populate hints.
3. **`jxp_count`** — check result size before fetching (especially large collections).
4. **`jxp_find`** — list or get by `id`; always set `fields` and a low `limit`.
5. **`jxp_export_csv`** — small CSV exports when JSON is awkward; no populate.

Never guess model names. Never fetch large collections without `fields` and `limit`.

## Query parameters (jxp_find / jxp_count / jxp_export_csv)

### filter

Mongo-style filter object. Examples:

```json
{ "filter": { "email": "user@example.com" } }
{ "filter": { "created": { "$gte": "2024-01-01" } } }
{ "filter": { "status": { "$in": ["active", "trial"] } } }
```

Use `jxp_describe_model` to see indexed fields worth filtering on.

### search

Full-text or field search (same as REST `?search=`).

### populate

Link expansion: `"populate[user]=name,email"` or object `{ "user": "name,email" }`.
Autopopulate is disabled for MCP by default (`MCP_DISABLE_AUTOPOPULATE=true`).

### fields

Comma-separated projection — **always use** for list queries:

```json
{ "model": "reader", "fields": "_id,email,name", "limit": 10 }
```

### sort, limit, page, skip

- `limit` — defaults to MCP default; hard-capped at MCP max.
- `page` / `skip` — pagination.
- `sort` — e.g. `-created` for newest first.

## Limits and safety

- MCP enforces stricter limits than HTTP (`MCP_DEFAULT_LIMIT`, `MCP_MAX_LIMIT`).
- JSON responses are capped (`MCP_MAX_RESPONSE_SIZE`); long strings are truncated.
- CSV exports are capped (`MCP_MAX_CSV_SIZE`).
- **Read-only** — no create, update, delete, aggregate, or stored procedures via MCP.

## Hidden models

Built-in auth collections (`user`, `apikey`, `token`, etc.) and `internal: true` schemas are hidden unless whitelisted via `MCP_MODEL_WHITELIST`. Blacklist always wins.

## Single document by id

```json
{ "model": "reader", "id": "507f1f77bcf86cd799439011" }
```
