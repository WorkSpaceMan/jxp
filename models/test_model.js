const mongoose     = require('mongoose');
const Schema = require("../libs/schema");

// This is just a shortcut for us
const ObjectId     = mongoose.Schema.Types.ObjectId;
const Mixed        = mongoose.Schema.Types.Mixed;

const TestSchema   = new Schema({
    foo: String, // A normal string
    bar: { type: String, unique: true, index: true }, // Ah! Some business logic!
    yack: Mixed, // We can put anything in here, including objects
    shmack: [String], // We can store arrays
    password: String, // Test password encryption
    fulltext: { type: String, index: { text: true } },
    link_id: { type: ObjectId, link: "link", },
    other_link_id: { type: ObjectId, link: "link", map_to: "other_link" },
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
// TestSchema.index( { "$**": "text" } );

// We can define useful functions that we can call through the API using our /call endpoint
TestSchema.statics.test = function() {
    return "Testing OKAY!";
};

// Finally, we export our model. Make sure to change the name!
const Test = mongoose.model('Test', TestSchema);

// Test.find({}).populate("link_test").exec((err, result) => { console.log(err, result)});
module.exports = Test;