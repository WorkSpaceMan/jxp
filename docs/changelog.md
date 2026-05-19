# Changelog

## v4.0.0

- **No `config` package** — configuration is via `.env` / environment variables and `jxp/libs/load-config` (compiled to `dist/libs/load-config.js`). Removed `/config/*.json` and the [node-config](https://www.npmjs.com/package/config) dependency.
- **TypeScript** — framework source is TypeScript; npm package ships compiled `dist/` with `.d.ts` types.
- **Build step** — `npm run build` (runs automatically on `npm install` via `prepare`).
- **Entry** — `main` / `types` point to `dist/libs/jxp.js` and `dist/libs/jxp.d.ts`.
- **Exports map** — `jxp` and `jxp/libs/query_manipulation` are formalized in `package.json` `exports`.
- **Node 22+** — `engines.node` is `>=22.0.0`.
- **Cache** — in-process `node-cache` (not apicache or Memcached).
- **Mongoose 6** — runtime dependency is Mongoose 6.13.9.
- **Model loader** — still loads consumer `*_model.js` files only; built-in models compile to `dist/models/`.
- **Globals types** — `/// <reference types="jxp/globals" />` for JS model authoring.
- **Breaking** — relative `model_dir` / `log` paths resolve from `process.cwd()` instead of the server script directory.

## 2.7.x

- Permanent Delete
- Cascade Delete

## 2.6.x

- Replace home-grown cache with apicache *(v4 uses node-cache instead)*
- Major performance boost when getting large collections (50secs to < 1 sec)
- /setup/data endpoint for scaffolding a complete system

## v2.5.x

- Documentation system

## v2.4.x

- Websockets
- Bulk uploads
- Advanced queries

## v2.0.1-1

- Tokens as the preferred login methodology

## v2.0.1-0

- Start v2!
- Move to "connection_string" for MongoDB connection - allows connectivity to Atlas, for example
- Use our own (much smarter) Schema class

## v1.2.4

- Time log includes operation number

## v1.2.3

- Throttling

## v1.0.16

- Add a /query endpoint, that allows you to POST { query } for advanced queries

## v1.0.12

- Select individual fields in populate joins

## v1.0.1

- Closed bad security hole in groups - now only admins can set groups. (Will probably change this in future so that only those defined in the usergroup model can change groups.)

## v1.0.0

- Mongoose v5 *(historical; v4 uses Mongoose 6.13.9)*
