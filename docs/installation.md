# Installation

JXP would typically run as a stand-alone server, although you can include it as a Javascript library.

## Requirements

JXP runs on [Node JS](https://nodejs.org/en/). We support Node v10 and above, and recommend Node v12.

JXP requires a [Mongo](https://www.mongodb.com/) database server to connect to. You can host your own, or we also support connecting to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas), which has a free tier if you don't want to have Mongo running locally. 

JXP will also take advantage of Memcache if you have it installed, although it's not a requirement. We can use a local or external Memcache server.

If you want to send out forgotten password links, you'll need an SMTP server you can connect to.

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

