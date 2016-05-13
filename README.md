# JExpress 2

JExpress is an opinionated RESTful API framework that lets you make an API just by defining you models.

It was initially built on Express and Mongoose (hence the name), but now it uses Restify.

## Installing

    npm install jexpress
    node server.js

## Models

Models are expected to be found in `./models`. They should be named `{modelname}_model.js`.

There are example models that come packaged with JExpress. You should really use the `group_model.js`, `user_model.js`, `apikey_model.js` and `token_model.js` since they are required for full functionality. In addition, `test_model.js` is used for the tests.

### Sample Model

**testmodel.js**

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