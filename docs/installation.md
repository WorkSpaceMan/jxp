# Installation

JXP would typically run as a stand-alone server, although you can include it as a Javascript library.

## Requirements

JXP runs on [Node.js](https://nodejs.org/en/). **Node.js 22 or newer is required** (`engines.node` is `>=22.0.0` in the package). We recommend the current Node 22 LTS release.

JXP requires a [MongoDB](https://www.mongodb.com/) database server to connect to. You can host your own, or connect to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas), which has a free tier if you don't want Mongo running locally.

Optional in-process response caching is available via environment variables (see [Caching](caching.md)). No external Memcache server is required.

If you want to send forgotten-password links, configure SMTP on your `JXP()` options object (see [Configuration](configuration.md#smtp-and-password-recovery)).

### JXP 4

JXP 4 is implemented in TypeScript and published as compiled JavaScript in `dist/`. The npm package includes a prebuilt `dist/`; `npm install jxp` does not compile from source. Cloning the repo and running `npm install` builds automatically when `src/` is present. Consumer apps still define models as `*_model.js` files in `MODEL_DIR`.

## Running on Docker

The repository includes `Dockerfile` and `docker-compose.yml`. Review those files and align environment variables with [Configuration](configuration.md) (`MONGO_CONNECTION_STRING` or `MONGODB_*` vars) before running `docker compose up -d`.

## Installing the easy way

JXP has a helper that will set up and configure an instance for you.

First, install JXP globally:

`npm install --global jxp`

Now run `jxp-setup <directory>` and follow the prompts. This will install the necessary files, give you a few models to get started, and help you set up an admin username and password.

Once the setup is complete, use `npm start` to start the server.

## Using as a library

Install via NPM:

`npm install --save jxp`

Then include in your project:

`const JXP = require("jxp")`

## Setup

NOTE: All the `/setup` endpoints will only run if the user table is empty to ensure that you can't overwrite an existing installation.

You can set up a first user using the `/setup` endpoint (GET or POST), with the following default properties that you can override:

```js
{
    email: "admin@example.com",
    password: "a randomly generated password",
    name: "admin"
}
```

Response:

```js
{
  status: "success",
  name: "admin",
  email: "admin@example.com",
  password: "randompassword"
}
```

You can scaffold an entire system by using the `/setup/data` endpoint. This writes directly to the database, and doesn't go through the API, so be careful — features like automatic password encryption will not take effect. You also need to use the collection names, not the model names, eg. the `user` model becomes `users`.

```js
{
   users: [
       { email: init.admin_email, password: init.admin_password, name: "Admin User", admin: true, urlid: "admin-user" },
       { email: init.email, password: init.password, name: "Jeff", admin: false, urlid: "jeff" },
    ],
    tests: [
        { foo: "setup_data", bar: "setup_data" }
    ]
}
```

Response:

```js
{
  status: "success",
  results: {
    users: {
      acknowledged: true,
      insertedCount: 2,
      insertedIds: { ... }
    },
    tests: {
      acknowledged: true,
      insertedCount: 1,
      insertedIds: { ... }
    }
  }
}
```
