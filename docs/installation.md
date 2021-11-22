# Installation

JXP would typically run as a stand-alone server, although you can include it as a Javascript library.

## Requirements

JXP runs on [Node JS](https://nodejs.org/en/). We support Node v10 and above, and recommend Node v16. It has been tested up to Node v17.

JXP requires a [Mongo](https://www.mongodb.com/) database server to connect to. You can host your own, or we also support connecting to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas), which has a free tier if you don't want to have Mongo running locally. 

JXP will also take advantage of Memcache if you have it installed, although it's not a requirement. We can use a local or external Memcache server.

If you want to send out forgotten password links, you'll need an SMTP server you can connect to.

## Running on Docker

You can run JXP on Docker using Docker Compose. Just run `docker-compose up -d` and it should Just Work (tm).

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

You can set up a first user using the `/setup` endpoint, with the following default properties that you can override:
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

You can scaffold an entire system by using the `/setup/data` endpoint. This writes directly to the database, and doesn't go through the API, so be careful -- features like the automatic password encryption will not take effect. You also need to use the collection names, not the model names, eg. the `user` model becomes `users`.

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
  status: 'success',
  results: {
    users: {
      result: [Object],
      ops: [Array],
      insertedCount: 2,
      insertedIds: [Object]
    },
    tests: {
      result: [Object],
      ops: [Array],
      insertedCount: 1,
      insertedIds: [Object]
    }
  }
}
```