/* global ObjectId Mixed */

const Schema       = require("../libs/schema");

const TestSchema   = new Schema({
    foo: String, // A normal string
    bar: { type: String, unique: true, index: true }, // Ah! Some business logic!
    yack: Mixed, // We can put anything in here, including objects
    shmack: [String], // We can store arrays
    password: String, // Passwords are automagically encrypted
    fulltext: { type: String, index: { text: true } },
    link_id: { type: ObjectId, link: "link", }, // We can populate these links during a query
    other_link_id: { type: ObjectId, link: "link", map_to: "other_link" },
    array_link_id: [{ type: ObjectId, link: "link", map_to: "array_link" } ], // TODO
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
const Test = Schema.model('Test', TestSchema);

// Test.find({}).populate("link_test").exec((err, result) => { console.log(err, result)});
module.exports = Test;