/* global JXPSchema ObjectId Mixed */
const errors = require("restify-errors");

const TestSchema = new JXPSchema({
    foo: String, // A normal string
    bar: { type: String, unique: true, index: true, default: "Some Default" }, // Ah! Some business logic!
    user_id: { type: ObjectId, link: "User" },
    yack: Mixed, // We can put anything in here, including objects
    shmack: [String], // We can store arrays
    password: String, // Passwords are automagically encrypted
    fulltext: { type: String, index: { text: true } },
    link_id: { type: ObjectId, link: "Link", }, // We can populate these links during a query
    other_link_id: { type: ObjectId, link: "Link", map_to: "other_link" },
    array_link_id: [{ type: ObjectId, link: "Link", map_to: "array_link", justOne: false } ],
    composite_array: [ 
        { afoo: String, abar: Number }
    ]
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

TestSchema.pre("save", function(next) {
    // If we have the setting "error" set to true, we will throw an error
    if (this.bar == "Throw an error") {
        throw new errors.ImATeapotError("I'm a teapot");
    }
    next();
});

// Finally, we export our model. Make sure to change the name!
const Test = JXPSchema.model('Test', TestSchema);
module.exports = Test;