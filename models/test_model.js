const mongoose     = require('mongoose');
const Schema       = mongoose.Schema;

// This is just a shortcut for us
const ObjectId     = mongoose.Schema.Types.ObjectId;
const Mixed        = mongoose.Schema.Types.Mixed;

// Link an external model
const Link         = require("./link_model");

const TestSchema   = new Schema({
    foo: String, // A normal string
    bar: { type: String, unique: true, index: true }, // Ah! Some business logic!
    yack: Mixed, // We can put anything in here, including objects
    shmack: [String], // We can store arrays
    password: String, // Test password encryption
    fulltext: { type: String, index: { text: true } },
    link_id: { type: ObjectId, ref: "Link" },
    _owner_id: ObjectId // This is one of the magic fields that will be populated by the API
});

// Full text index
TestSchema.index( { "$**": "text" } );

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