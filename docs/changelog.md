# Changelog

Notable changes to [JXP](https://github.com/WorkSpaceMan/jxp).

## v4.0.0 — 2026-05-19

Major release: complete TypeScript rewrite and configuration overhaul.

### Breaking changes

- **Security hardening (4.0)** — see [migration](#security-hardening-migration) below.
- **No `config` package** — configuration via `.env` / environment variables and `jxp/libs/load-config` (compiled to `dist/libs/load-config.js`). Removed `/config/*.json` and [node-config](https://www.npmjs.com/package/config).
- **TypeScript** — framework source under `src/`; npm package ships compiled `dist/` with `.d.ts` types.
- **Build from source** — `npm run build` when developing from a git clone; npm registry installs ship prebuilt `dist/`.
- **Entry point** — `main` / `types` → `dist/libs/jxp.js` and `dist/libs/jxp.d.ts`.
- **Node 22+** — `engines.node` is `>=22.0.0`.
- **Relative paths** — `model_dir` and `log` resolve from `process.cwd()`, not the server script directory.
- **Built-in models** — compile from `src/models/*.ts` to `dist/models/`; consumer apps still use `*_model.js` in `MODEL_DIR`.

### Added

- **`loadJxpConfig()`** — builds `JXP()` options from environment variables (`.env`, `.env.test`).
- **`package.json` `exports` map** — `jxp`, `jxp/libs/query_manipulation`, `jxp/libs/load-config`, `jxp/globals`.
- **Globals types** — `/// <reference types="jxp/globals" />` for JavaScript model authoring.
- **[docs/typescript.md](typescript.md)** — v4 migration guide.
- **Built-in documentation UI** — landing page, MkDocs nav sidebar, per-model API reference.
- **Interactive API console** — try REST endpoints from model pages; optional API key in docs navbar.
- **Query limits** (from v3.1) — env/config `query_limits`; default limit on all list/query requests; required explicit `?limit=` on large collections.
- **Security modules** — `query_sanitize`, `aggregate_guard`, `bulkwrite_guard`, `call_guard`, `response_sanitize`, `link_index`, `safe_error`.
- **Schema options** — `callable_statics` (string array); `advanced_queries: { query?, aggregate?, bulkwrite? }` (bulkwrite off by default).
- **Config / env** — `security.strip_fields`, `cors.origins`; `QUERY_LIMITS_DEFAULT`, `QUERY_LIMITS_SKIP_COUNT_UNLESS_PAGINATED`, `CORS_ORIGINS` (see [configuration.md](configuration.md)).
- **Startup helpers** — Node 22+ deprecation warnings; `quiet_startup` option.

### Changed

- **List responses** — `count` and `page_count` are omitted unless the client passes `?count=true` or `?page=` (avoids `countDocuments` on every list request).
- **CORS** — origins read from `config.cors.origins` (default `["*"]` if unset).
- **`/update/:model/:id`** — uses document load + `save()` (validators/hooks) instead of deprecated `Model.update()`.
- **Delete** — referrer checks use a pre-built link index and run in parallel.
- **`admin_only` middleware** — passes errors via `next(err)` for correct Restify handling.
- **Mongoose 6.13.9** (pinned).
- **Cache** — in-process [node-cache](https://www.npmjs.com/package/node-cache) *(replaces apicache from v2.6)*.
- **CSV** — `@json2csv/plainjs` replaces `json2csv`.
- **Email** — `nodemailer` 8.x; removed `nodemailer-smtp-transport`.
- **Docs rendering** — `markdown-it`; MkDocs pages from `docs/*.md`.
- **Tests** — Mocha 11; `test/env.js` loads `.env.test`; `test/security_hardening.test.js` for guards and allowlists.
- **Documentation** — full MkDocs audit for v4 behavior; security notes in [api.md](api.md), [queries.md](queries.md), [aggregations.md](aggregations.md), [bulk_writes.md](bulk_writes.md), [caching.md](caching.md), [schemas.md](schemas.md), [special.md](special.md).

### Fixed

- **`actionCallItem`** — `findById` is awaited; deleted documents are rejected; request body is passed to the static.
- **`apiKeyAuth`** — missing `await` on `User.findOne` when resolving API key users.
- **`middlewareModel`** — returns 404 when model name is unknown (no silent `undefined` model).
- **Filter depth** — exceeding max depth returns 400 instead of passing raw input through.

### Security hardening migration

Consumer apps (e.g. RevEngine) should adjust clients and models as follows:

| Area | Before | After |
|------|--------|--------|
| List GET / POST `/query` | Unbounded or large default on small collections | Default `?limit=100` when omitted; collections ≥10k docs still require explicit `?limit=` |
| Totals in list JSON | `count` always present | Pass `?count=true` or `?page=` when you need `count` / `page_count` |
| `/call/:model/:method` | Any schema static callable | Only names listed in `callable_statics` |
| `/cache/stats`, `/cache/clear` | No auth | Admin login required |
| `password_override=1` | Any authenticated user | Admin only |
| User PUT | Could set `admin` / `password` | Non-admins have privilege fields stripped |
| `?filter[$where]=…` | Accepted | **400** — operator denied |
| POST `/aggregate` | Any pipeline stage | Allowlisted stages; `$out` / `$merge` / `$function` need admin |
| POST `/bulkwrite` | Open | **Disabled per model** unless `advanced_queries.bulkwrite: true`; op allowlist |
| List passwords | Could leak on `GET /api/user` | Stripped from list/query/aggregate responses |

Example model opts:

```js
new JXPSchema({ ... }, {
  perms: { admin: "crud", user: "r" },
  callable_statics: ["preview_segment", "apply_segment"],
  advanced_queries: { bulkwrite: true }, // only if HTTP bulkwrite is required
});
```

---

## v3.1.0 — 2026-05-19

- **Query limits for large collections** — `query_limits` config; `GET /api/<model>`, `GET /csv/<model>`, and `POST /query/<model>` require `?limit=` when collection size exceeds threshold (default 10,000 documents).
- New `query_limits.js` module, tests, and API documentation.

---

## v3.0.0 — 2025-04-17

Repository refresh and dependency modernization:

- Better MongoDB connection handling.
- Proper HTTP errors on login failure.
- Additional request logging.
- Package upgrades; Docker and ESLint scaffolding.

### Patch-level (same era)

- **2025-04-17** — Correct documentation for `x-api-key` header.
- **2025-04-05** — Fix `deepExtend` bug.

---

## v2.15.0 — 2025-03-25

- Fix potential stack size exceeded errors.
- Fix documentation circular reference errors.
- Dependency updates.
- Date range handling improvements.

---

## v2.14.6 — 2024-01-24

- Package upgrades.
- Log Mongoose version on startup.

## v2.14.5 — 2023-12-21

- Maintenance release.

## v2.14.4 — 2023-12-21

- Dependency bumps.

## v2.14.3 — 2023-12-21

- `jxp-helper` version update.

## v2.14.0 — 2023-02-27

- **`.env` support** — environment-based configuration instructions and loading.
- Link to external docs instead of inline documentation.
- Repository moved to [WorkSpaceMan/jxp](https://github.com/WorkSpaceMan/jxp) (2023-07-10).
- Dependency upgrades.

### Caching (v2.14 era, 2023-01)

- In-memory response caching with smarter invalidation.
- Invalidate whole cache when links complicate partial invalidation.
- Don't crash when cache object isn't configured.

---

## v2.12.3 — 2023-01-18

- Dependency upgrades.
- Require Mongoose as peer dependency.

## v2.12.0 — 2022-12-05

- Better error handling; server stays up on non-fatal errors.
- Tests passing again.
- Mongoose and Restify upgrades.
- Default to `127.0.0.1` instead of `localhost`.
- Show JXP version on load; reduce noisy logging.
- `--legacy-peer-deps` note for source installs.

## v2.11.0 — 2022-11-28

- Pass `__user` on `get` and `getOne` actions.
- Async/`next` fixes.
- **Note:** Node versions above 17 were unsupported at this release.

---

## v2.7.0 — 2021-02-09

- **Permanent delete** — `?_permaDelete=1`.
- **Cascade delete** — `?_cascade=1`.
- **`_updated_by_id`** set on PUT; populated as `_updated_by`.
- Default `count` returns `-1` on very large collections (performance).
- `/setup/data` casts `_id` fields to ObjectIds and sets `_deleted: false`.

## v2.6.x — 2021-01-06

- **apicache** replaces home-grown cache; configurable cache timeout.
- Major **GET performance** improvement on large collections.
- **Built-in documentation system** (MkDocs + in-server docs routes).
- Default port changed to **4001** (conflict on M1 Macs).
- Model docs refactored to separate library.
- Dependency upgrades (including Axios security fix).
- Return 404 for missing model.

## v2.5.x — 2021-01-06

- Documentation system introduced (see v2.6.x).

## v2.4.x — 2020-07 – 2020-08

- **WebSockets** — subscribe to model/item changes; auth via basic, apikey, or bearer token; filtering on subscriptions.
- **Bulk writes** — `/bulkwrite/<model>` endpoint.
- **`/query/<model>`** — POST advanced MongoDB queries.
- **`/aggregate/<model>`** — aggregation pipelines; `allowDiskUse` query param; inline ObjectId and Date strings.
- **`relative_date()`** in aggregation pipelines.
- **`/count/<model>`** endpoint.
- Populate `_owner_id` as `_owner`.
- OAuth login uses renewable API keys (2022-01).

## v2.0.x — 2020-05-06 – 2020-07

Major v2 rewrite ([PR #11](https://github.com/WorkSpaceMan/jxp/pull/11)):

- Renamed project to **JXP**; MongoDB **connection string** (Atlas-compatible).
- **JXPSchema** — links, autopopulate, `ObjectId`/`Mixed` globals, automagic `_owner_id` / `_deleted`.
- **Bearer tokens** and refresh tokens as preferred auth.
- **Stored procedures** via `/call/<model>/<static>`.
- **Hooks** — `pre_hooks` / `post_hooks` on server config.
- Response shape `{ data }` for single records.
- Setup scaffolding (`jxp-setup`), link model, soft delete.
- Pre/post Mongoose middleware documented.
- WebSocket support started (completed in v2.4).

---

## v1.x — 2016 – 2019

### v1.2.4 — 2019-11-06

- Time log includes operation number.

### v1.2.3 — 2019-11-06

- Request **throttling**.

### v1.0.16 — 2019-05-02

- **`POST /query/<model>`** for advanced queries.

### v1.0.12 — 2019-04-03

- Select individual fields in populate joins.

### v1.0.1 — 2019-02-13

- **Security:** only admins can assign user groups.

### Earlier v1 highlights

- **2019-03** — CSV export; async/await refactor; non-blocking bcrypt password checks; caching (early).
- **2019-02** — Renamed to JXP; CORS plugin; Mongoose 5; full-text search.
- **2018-12** — Soft delete (`_deleted`); `showDeleted`; refactor from Q to async/await; `bcryptjs`.
- **2018-02** — Password field auto-encryption; config module.
- **2017** — Setup endpoint; pre-hooks; `model_dir` (relative/absolute); field selection; groups.
- **2016-05** — Initial release: REST CRUD from Mongoose models, auth, populate, filter, search, pagination, permissions, `jexpress-setup` CLI.

---

## Version notes

| Era | Mongoose | Node (documented) |
|-----|----------|-------------------|
| v4 | 6.13.9 | 22+ |
| v3.x | 6.x | — |
| v2.11 | — | ≤17 (warning in release) |
| v1 / early v2 | 5.x | — |

See the [v4.0.0 release](https://github.com/WorkSpaceMan/jxp/releases/tag/v4.0.0) and [compare view since v3.1.0](https://github.com/WorkSpaceMan/jxp/compare/7224093...v4.0.0).
