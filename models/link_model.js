/* global JXPSchema */

const LinkSchema = new JXPSchema({
    name: String,
    val: String,
},
{
    perms: {
        admin: "crud",
        owner: "crud",
        user: "cr",
        all: "r"
    }
});

const Link = JXPSchema.model('Link', LinkSchema);
module.exports = Link;