/* global ObjectId */

const Schema     = require("../libs/schema");

const LinkSchema   = new Schema({
    name: String,
    val: String,
    _owner_id: ObjectId
},
{
    perms: {
        admin: "crud",
        owner: "crud",
        user: "cr",
        all: "r"
    }
});

const Link = Schema.model('Link', LinkSchema);
module.exports = Link;