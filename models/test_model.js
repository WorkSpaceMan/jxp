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
    password: String, // Test password encryption
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