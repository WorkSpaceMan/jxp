const mongoose     = require('mongoose');
const Schema       = mongoose.Schema;
const ObjectId     = mongoose.Schema.Types.ObjectId;

const LinkSchema   = new Schema({
    name: String,
    val: String,
    _owner_id: ObjectId
});

// We can set permissions for different user types and user groups
LinkSchema.set("_perms", {
    admin: "crud", // CRUD = Create, Retrieve, Update and Delete
    owner: "crud",
    user: "cr",
    all: "r" // Unauthenticated users will be able to read from test, but that is all
});

module.exports = mongoose.model('Link', LinkSchema);