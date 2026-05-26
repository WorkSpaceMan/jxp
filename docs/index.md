# JXP API

JXP is an opinionated REST framework: define Mongoose schemas and get a production-ready API with authentication, permissions, population, filtering, and more.

JXP 4 requires **Node.js 22+**, ships as compiled TypeScript, and uses environment-based configuration (see [Installation](installation.md) and [TypeScript](typescript.md)).

## Features

* Authentication and password encryption handled for you
* Smart link population on read
* Search, sort, filter, and populate via the URL
* Field selection to return only what you need
* Fast model changes — schemas drive the API
* Standard REST interface (GET, POST, PUT, DELETE)
* CSV export for collections
* Groups and per-model permissions
* Hooks for business logic
* Stateless and easy to deploy
* WebSocket change subscriptions
* [Index diagnostics](index_diagnostics.md) — schema vs DB indexes and optional query monitoring

## Links

* [JXP on NPM](https://www.npmjs.com/package/jxp)
* [GitHub Repository](https://github.com/WorkSpaceMan/jxp)
* [JXP Helper](https://www.npmjs.com/package/jxp-helper) — client library for JXP
* [Documentation on ReadTheDocs](https://jxp.readthedocs.io)
