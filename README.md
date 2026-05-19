# JXP

JXP is an opinionated RESTful API framework that lets you make an API just by defining models.

## Features

* Takes care of the plumbing, like authentication and password encryption
* Get all the data you need with smart link population
* Search, sort, filter, populate... all on the url
* Get just the data you need with field selection
* Super-fast and easy to add and change models
* An obvious and standard API interface
* CSV output to quickly grab your data
* Permissioning and groups baked in
* Ability to handle business logic
* Simple to deploy
* Lightning-fast
* Logging, done
* Stateless

## Quick Start

    npm install -g jxp
    jxp-setup my-app
    cd my-ap
    npm start

## Installing from source

```bash
npm i --legacy-peer-deps
npm run build   # compiles TypeScript (also runs on install via prepare)
npm start       # sample server at dist/bin/server.js
```

Requires **Node.js 22+** and MongoDB for the sample server and integration tests.

## TypeScript

JXP 4 is implemented in TypeScript. See [docs/typescript.md](docs/typescript.md) for building from source, consuming types in JavaScript apps, and authoring typed models.

## Documentation

* [TypeScript / v4 migration](docs/typescript.md)
* [Installation](https://jxp.readthedocs.io/en/v2.0.0/installation)
* [Configuration](https://jxp.readthedocs.io/en/v2.0.0/configuration)
* [Authentication](https://jxp.readthedocs.io/en/v2.0.0/authentication)
* [Schemas](https://jxp.readthedocs.io/en/v2.0.0/schemas)
* [Restful API](https://jxp.readthedocs.io/en/v2.0.0/api)
* [Roles and Permissions](https://jxp.readthedocs.io/en/v2.0.0/permissions)
* [Hooks](https://jxp.readthedocs.io/en/v2.0.0/hooks)
* [Special Features](https://jxp.readthedocs.io/en/v2.0.0/special)
* [Changelog](https://jxp.readthedocs.io/en/v2.0.0/changelog)