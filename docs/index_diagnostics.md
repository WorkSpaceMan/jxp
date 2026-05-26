# Index diagnostics and query monitoring

JXP can compare **Mongoose schema indexes** to indexes in MongoDB, optionally sync them, and (when enabled) sample read queries with `explain('executionStats')` to flag likely unindexed or inefficient access patterns.

## Index audit (schema vs database)

Mongoose provides `Model.diffIndexes()` and `Model.syncIndexes()`. JXP wraps these for all loaded models.

### CLI

```bash
npm run indexes
# or
npx jxp-indexes
```

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable report |
| `--unused` | Include `$indexStats` hints for indexes with zero ops |
| `--sync` | Apply `syncIndexes()` (create missing, drop extras) |
| `--confirm DROP_EXTRA_INDEXES` | Required with `--sync` |

Example:

```bash
npm run indexes -- --json
npm run indexes -- --sync --confirm DROP_EXTRA_INDEXES
```

Exit code `1` when any collection has missing or extra indexes (audit mode only).

Requires `MODEL_DIR` and Mongo connection env vars (same as the API server).

### Web UI

Open **`/docs/diagnostics`** in the API docs browser (same sign-in as `/docs/api`). The page lets admins:

- Refresh the index audit and view missing/extra indexes per collection
- Browse the query log (from MongoDB when the `IndexQueryLog` model is loaded)
- Sync indexes after typing `DROP_EXTRA_INDEXES`

Use an **admin** API key in the docs top bar.

### Admin HTTP API

Admin authentication required (`security.admin_only`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/diagnostics/indexes` | Audit report (`?refresh=true`, `?unused=true`) |
| GET | `/diagnostics/queries` | Recent query monitor entries + config |
| POST | `/diagnostics/indexes/sync` | Body `{ "confirm": "DROP_EXTRA_INDEXES" }` |

## Query monitor

MongoDB does not emit “missing index” events. When the monitor is enabled, JXP samples read operations (`find`, `findOne`, `count`, `countDocuments`, `distinct`), runs `explain('executionStats')` on a **clone** of the query (async, non-blocking), and records **alert** / **warn** entries.

### Where queries are stored

| Layer | Purpose |
|-------|---------|
| **`IndexQueryLog` model** (MongoDB) | Primary store — one document per flagged query. Auto-loaded from the jxp package (`indexquerylog_model.js`). TTL via `INDEX_QUERY_LOG_RETENTION_DAYS` (default 30). |
| **In-memory ring buffer** | Fast fallback when the model is unavailable; also used for recent samples before persistence. Size: `QUERY_INDEX_BUFFER_SIZE`. |

The `IndexQueryLog` collection is excluded from query monitoring (reads/writes to the log do not create new log entries). Explain runs use `query.clone().explain()` with an internal flag so Mongoose post hooks do not treat the explain as another sampled query (no monitor loop). The model is a **built-in** — you do not need `indexquerylog_model.js` in your app's `MODEL_DIR` unless you want to override it (see [Configuration — Built-in models](configuration.md#built-in-models)). Admins can also list logs via `GET /api/indexquerylog` with normal JXP filters.

Query monitor is enabled in development by default (`QUERY_INDEX_MONITOR=true`). In production, set `INDEX_DIAGNOSTICS_ENABLED=true` and tune `QUERY_INDEX_SAMPLE_RATE` (e.g. `0.02`).

**Heuristics (approximate):**

- **alert** — `COLLSCAN` (or nested collection scan) with high `totalDocsExamined` vs `nReturned`
- **warn** — index used but many more documents examined than returned
- **ignore** — small collections (below threshold), or benign plans

`explain` with `executionStats` executes the query again — use sampling in production.

### Environment variables

| Variable | Default (dev) | Default (production) |
|----------|---------------|----------------------|
| `INDEX_DIAGNOSTICS_ENABLED` | off | off (master enable for prod) |
| `QUERY_INDEX_MONITOR` | `true` | `false` |
| `QUERY_INDEX_SAMPLE_RATE` | `1.0` | `0.02` |
| `QUERY_INDEX_MIN_DOCS_EXAMINED` | `20` | `100` |
| `QUERY_INDEX_DOCS_EXAMINED_RATIO` | `5` | `10` |
| `QUERY_INDEX_SMALL_COLLECTION_THRESHOLD` | `500` | `1000` |
| `QUERY_INDEX_BUFFER_SIZE` | `200` | `200` |
| `INDEX_QUERY_LOG_RETENTION_DAYS` | `30` | `30` |

In production, set `INDEX_DIAGNOSTICS_ENABLED=true` (and tune sample rate) to enable monitoring.

### Config object

```javascript
JXP({
  index_diagnostics: {
    enabled: true,
    query_monitor: {
      enabled: true,
      sample_rate: 0.05,
      min_docs_examined: 100,
    },
  },
});
```

Register the monitor **before** models load (the sample `server.ts` calls `registerQueryIndexMonitor()` before `JXP()`).

## Programmatic use

```javascript
const {
  auditAllModels,
  syncAllModels,
  loadModelsFromDir,
  classifyExplain,
} = require("jxp/libs/index_diagnostics");
```

## Complementary tools

- MongoDB [Profiler](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/) and Compass — slow query analysis
- Atlas Performance Advisor — index suggestions (Atlas)
- `db.collection.explain()` — manual plan inspection

JXP diagnostics do not replace these; they integrate index drift checks into your JXP app workflow.
