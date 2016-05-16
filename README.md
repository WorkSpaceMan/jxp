# JExpress 2

JExpress is an opinionated RESTful API framework that lets you make an API just by defining you models.

It was initially built on Express and Mongoose (hence the name), but now it uses Restify.

## Installing

    npm install jexpress

## Building a server

### ./bin/server.js

```js
var mongoose = require("mongoose");
var JExpress = require("jexpress");
var config = require('../config'); // See the config sample

/*
 * We can customise the callbacks for sending to a websocket, message queue or logging
 */

config.callbacks = {
    post: function(modelname, item, user) {
        console.log("Post callback");
    },
    put: function(modelname, item, user) {
        console.log("Put callback");
    },
    delete: function(modelname, item, user, opts) {
        console.log("Delete callback");
    }
};

/*
 * We establish our database connection
 */
config.mongo = config.mongo || { server: "localhost", db: "openmembers" };

mongoose.connect('mongodb://' + config.mongo.server + '/' + config.mongo.db, function(err) {
    if (err) {
        console.error("Connection error", err);
        throw(err);
    }
}, { db: { safe:true } }); // connect to our database

/*
 * Start your engines!
 */
var server = new JExpress(config);
server.listen(config.port || 4001, function() {
    console.log('%s listening at %s', server.name, server.url);
});
```

### ./config.js

```js
module.exports = {
    port: "3001",
    url: "http://localhost:3001",
    mongo: {
        server: "localhost",
        db: "openmembers",
    },
    model_dir: "./models",
    smtp_server: "mail.myserver.com",
    smtp_username: "me@myserver.com",
    smtp_password: "MyPassword",
    password_recovery_url: 'http://localhost:3000/login/reset',
    shared_secret: "DontTell", // We use this to encrypt our JWT token, so it should be shared with our front-end site
    oauth: {
        success_uri: "http://localhost:3000/login/oauth",
        fail_uri: "http://localhost:3000/login/oauth/fail",
        facebook: {
            app_id: "12345",
            app_secret: "abcd123",
            scope: "email,user_about_me,user_friends",
            auth_uri: "https://www.facebook.com/dialog/oauth",
            token_uri: "https://graph.facebook.com/v2.3/oauth/access_token",
            api_uri: "https://graph.facebook.com/me?fields=id,name,about,age_range,bio,email,picture",
        },
        twitter: {
            app_id: "12345",
            app_secret: "abcd123",
            auth_uri: "https://api.twitter.com/oauth/authenticate",
            api_uri: "https://api.twitter.com/1.1/",
            token_uri: "https://api.twitter.com/oauth2/token"
        },
        google: {
            app_id: "12345",
            app_secret: "abcd123",
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            scope: "email+profile",
            api_uri: "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
            token_uri: "https://www.googleapis.com/oauth2/v3/token"
        },
        linkedin: {
            app_id: "12345",
            app_secret: "abcd123",
            auth_uri: "https://www.linkedin.com/uas/oauth2/authorization",
            scope: "r_basicprofile%20r_emailaddress",
            api_uri: "https://api.linkedin.com/v1/people/~:(id,num-connections,picture-url,email-address)?format=json",
            token_uri: "https://www.linkedin.com/uas/oauth2/accessToken",
            email_field: "emailAddress"
        }
    }
};
```

## Models

Models are expected to be found in `./models`. They should be named `{modelname}_model.js`.

There are example models that come packaged with JExpress. You should really use the `group_model.js`, `user_model.js`, `apikey_model.js` and `token_model.js` since they are required for full functionality. In addition, `test_model.js` is used for the tests.

### Sample Model

**testmodel.js**

```js
var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

// This is just a shortcut for us
var ObjectId = mongoose.Schema.Types.ObjectId;
var Mixed = mongoose.Schema.Types.Mixed;

var TestSchema   = new Schema({
    foo: String, // A normal string
    bar: { type: String, unique: true, index: true }, // Ah! Some business logic!
    yack: Mixed, // We can put anything in here, including objects
    shmack: [String], // We can store arrays
    _owner_id: ObjectId // This is one of the magic fields that will be populated by the API
});

// We can set permissions for different user types and user groups
TestSchema.set("_perms", {
    admin: "crud", // CRUD = Create, Retrieve, Update and Delete
    owner: "crud",
    user: "cr",
    all: "r" // Unauthenticated users will be able to read from test, but that is all
});

// We can define useful functions that we can call through the API using our /call endpoint
TestSchema.statics.test = function() {
    return "Testing OKAY!";
};

// Finally, we export our model. Make sure to change the name!
module.exports = mongoose.model('Test', TestSchema);
```

### Soft deleting

Add the field `_deleted: { type: Boolean, default: false }` to stop the system from permanently deleting items. It will show up as a 404 if you try to access it, and it won't appear in listings, unless you add the parameter `showDeleted=1` to your listing. You can undelete the item by setting `_deleted` to false on a PUT.

### Versions

Add the field `_version: { type: Number, default: 0 }` to keep a version count. Note that we don't keep the previous versions, just a count of how many times the item has been changed.

### Special functions

You can write your own functions in your models to do whatever you want. You can access these through the `/call` endpoint. Declare these as a static Mongoose function.

`/call/test/testFunc`

```js
TestSchema.statics.test = function(data) {
    console.log(data);
    return "Testing OKAY!";
};
```

You can GET your static, or POST data to it. 

You can even prepopulate the function with an item:

`/call/test/:item_id/testItem`

```js
TestSchema.statics.testItem = function(item, data) {
    console.log("Item", item);
    console.log("Data", data);
};
```

## Authentication

### API Key

You can authenticate as a user through one of two methods. The first is through requesting an API key. (This is really more of a token. Let's not dwell on this, shall we?)

The login endpoints are:

* POST `/login` -- Send `email` and `password` to recieve an API key which you can use to authenticate yourself
* POST or GET `/login/logout` -- Expire the API key
* `/login/jwt` -- Request a one-time JSON Web Token that you can use to log in through your front end
* `/login/recover` -- Send the user an email with their JWT embedded so that they can reset their password

Once you have an API key, you can append `?apikey=MyAPIKey` to the end of any request to authenticate yourself.

### Basic Auth

Basic auth encodes (NOTE: ***NOT*** encrypts) your username and password and sends it as part of the header. You can use Basic Auth to authenticate yourself at any time. 

***NOTE:*** You should only use basic auth over SSL, since it is trivial to decode the username and password. In fact, you should use SSL for everything, anway.

## Access Control

You can set permissions on each model for user groups which you can define yourself. There are also a few special groups:
* `all` -- All users, whether they authenticate or not.
* `owner` -- The user who created an item. This requires the model to have a `_owner_id` property (see the above example).
* `user` -- Any authenticated user.
* `admin` -- Any admin user.

Each group can have one, some or all of the following permissions:
* `c` -- Create -- the ability to create a new record (a POST operation)
* `r` -- Retrieve -- the ability to read a record or all records (a GET operation)
* `u` -- Update -- the ability to update an existing record (a PUT operation)
* `d` -- Delete -- the ability to delete an existin record (a DELETE operation)

The permissions are defined in the model as follows:

```js
TestSchema.set("_perms", {
    admin: "crud", // CRUD = Create, Retrieve, Update and Delete
    owner: "rud",
    user: "cr",
    all: "r" // Unauthenticated users will be able to read from test, but that is all
});
```

In this case, the admin and record owner have full permissions. (We don't need to set "create" for the owner, obvz.) An authenticated user can create and retrive records. Everyone can read everything.

To make a model completely private, just don't set the perms.

## Groups

You can add and remove groups to a user with the `/groups/:user_id` endpoint. The group will be automatically created if it doesn't already exist.

* GET gets all the groups for the user
* PUT adds a group
* POST rewrites the user's groups
* DELETE deletes the matching group  

The field needs to be named `group`. You can even have an array of groups, eg. `group[0]`, `group[1]` etc.

***Example***

Note that you'll need to authenticate as an admin through one of the methods described for these examples

Set the user's group to `test`

```
curl -X POST -F "group=test" "http://localhost:3001/groups/5485bd62fbad8791660d2658"
```

Add the groups `test1` and `test2`

```
curl -X PUT -F "group[0]=test0" -F "group[1]=test1" "http://localhost:3001/groups/5485bd62fbad8791660d2658"
```

## API

The API lets us read, create, update and delete items. Generally, our `endpoint` (API-speak for URL) decides which collection or item we're referring to, and the HTTP `verb` describes whether we want to read (GET), create (POST), update (PUT) or delete (DELETE). Strict RESTful APIs also have PATCH and OPTIONS. JExpress doesn't. A PUT is a PATCH. Deal with it.

### GET

We can either GET an entire collection, or an individual item. For an entire collection, we use the endpoint `/api/{modelname}`. For instance, GET `/api/test` would return all the test items. Please note that it will always return ALL the items. If you have a big collection, use the `limit` function because we don't do that for you.

For an individual item, we just add the `_id` to the endpoint, as in `/api/{modelname}/{_id}`. Eg. GET `/api/test/5731a48b7571ff6248bd6d9c`.

### POST

POST always saves a new item, so the endpoint is always `/api/{modelname}`. For instance, POST `/api/test` would create a new test item.

### PUT

PUT updates an existing item, so the endpoint needs to include the _id, as in `/api/{modelname}/{_id}`. Eg. PUT `/api/test/5731a48b7571ff6248bd6d9c`.

### DELETE

As with PUT, we need to reference a specific item, so the endpoint needs to include the _id, as in `/api/{modelname}/{_id}`. Eg. DELETE `/api/test/5731a48b7571ff6248bd6d9c`.