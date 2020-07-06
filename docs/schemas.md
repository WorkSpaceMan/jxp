# Schemas

The real power of JXP is that you can define your entire API architecture on the fly with some simple-to-use Schemas. Say your client decides that, while previously it stored its customers' address as a single item, it now wants to split out physical and postal addresses. With JXP, you can make and deploy this kind of change in under a minute. Even massive new features will take a few minutes to develop. 

At the same time, the schemas are very powerful. You can embed some serious business logic in them, from simple data validation to complex business rules, or automatically fire off a host of changes rippling throughout your system based on a single event.

If you need to do some heavy data lifting and don't want to first get the data into your application, you can create the equivalent of stored procedures that perform joins, do calculations, and aggregate loads of data on the fly.

The schemas are based on Mongoose, so anything you can do with a [Mongoose schema](https://mongoosejs.com/docs/guide.html#definition), you can do with our schemas. You can use a vanilla Mongoose Schema object, but because this is an opinionated API, we suggest you use the much more powerful JXP Schema, which gives you a lot of cool stuff for free. 

## Defining a schema

Schemas are all found in the `/models` directory, and have the format `/models/<name>_model.js`. Each schema represents a collection in Mongo, with the Mongo collection name being the plural of the schema name. Eg. the data for `user_model.js` is stored in the `users` collection in Mongo.

A typical schema looks like `/models/test_model.js`:
```javascript
/* global JXPSchema ObjectId Mixed */

const TestSchema   = new JXPSchema({
    foo: String, // A normal string
    bar: { type: String, unique: true, index: true }, // A unique string
    yack: Mixed, // We can put anything in here, including objects
    shmack: [String], // We can store arrays
    password: String, // Passwords are automagically encrypted
    fulltext: { type: String, index: { text: true } },
    link_id: { type: ObjectId, link: "Link", }, // We can populate these links during a query
    other_link_id: { type: ObjectId, link: "Link", map_to: "other_link" },
    array_link_id: [{ type: ObjectId, link: "Link", map_to: "array_link" } ], // TODO
},
{
    perms: {
        admin: "crud", // CRUD = Create, Retrieve, Update and Delete
        owner: "crud",
        user: "cr",
        all: "r" // Unauthenticated users will be able to read from test, but that is all
    }
}
);

// Full text index
TestSchema.index( { "$**": "text" } );

// We can define useful functions that we can call through the API using our /call endpoint
TestSchema.statics.test = function() {
    return "Testing OKAY!";
};

// Finally, we export our model. Make sure to change the name!
const Test = JXPSchema.model('Test', TestSchema);
module.exports = Test;
```

The `new JXPSchema(definition, options)` function takes two parameters, the first being the schema definition, and the second options for the schema.

## Definitions

The schema's definitions define the collection's fields, and the field types. Note that you can have primitive and advanced data types. There are two data types that come from Mongoose's types that we include in the global scope for convenience: `ObjectId` which represents a Mongo ObjectId, and `Mixed`, which can be just about anything.

You can give just the type as a value, or use an object if you need to add options, such as indexing, linking, or validation on a field.

Enclosing a type in square brackets denotes an array.

## Links

Links are one of the most powerful features of JXP. They allow you to define a relationship between documents in different collections. If you're coming from a relational database environment, this will be very familar to you.

When we get to querying the data, we can join related documents together and get a complete record (or parts thereof). To define a relationship, we give it a type of ObjectId (since the _id of the related document will be stored as our value). We use the key `link` to define the schema we want to get the data from. And if we want the result to use a different key, we can use `map_to` to define that result key.

```javascript
other_link_id: { type: ObjectId, link: "Link", map_to: "other_link" },
```

This is similar to Mongoose's `ref` option, but it differs in two important ways:
* We don't need to import the referring model
* Mongoose overwrites the original ObjectId value with the related document. JXP presents the document as a separate key.

NB: Use the name of the external schema (with the same capitalisation) in your link. Eg. If you are linking a user to an organisation, and you declared your user schema with `const User = new JXPSchema...` then you would use `link="User"` and not `link="user"`. However, when populating that link, you would use the lowercase form, `user`. Eg. `?populate[user]=name` to return the user's name.

## Options

### perms

The `perms` option allows us to define who has access to this collection, and what rights they have. You can read more about [permissions here](permissions.md).

### Mongoose options

You can use other [Mongoose options](https://mongoosejs.com/docs/guide.html#options). We override the following Mongoose options:

```javascript
timestamps: true,
toJSON: { virtuals: true },
toObject: { virtuals: true }
```

## Automagic fields

We define a few more fields that you won't see in your schema, but should know that they're there since you can query them if you need:

```javascript
_deleted: Boolean
```

When a document is deleted, we don't actually remove it from the database. We mark it as `_deleted`. It becomes invisible to the API (except in a few cases), but the data is still there in case you want to retrieve it.

```javascript
_owner_id: ObjectId
```

This is a link to the `user` that originally created the document. This is used for permissioning the `owner` rights.

```javascript
createdAt: Date,
updatedAt: Date
```

We always store the created and updated timestamp.

```javascript
_v: Number
```

The version is tracked.

## Stored Procedures

You can write your own stored procs in your schemas to do whatever you want. You can access these through the `/call` endpoint. Declare these as a static Mongoose function.

`/call/test/test`

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

The static call will include the user's data as `data.__user`. [NOTE: This will probably change to "sender" before v2 is finalised.]

## Pre- and post-fuctions

You can use [Mongoose pre- and post-middleware](https://mongoosejs.com/docs/middleware.html#post) to do advanced validation or to return a calculated field with your results.