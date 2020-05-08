/* global ObjectId */

var Schema = require("../libs/schema");

var UserGroupSchema   = new Schema({
	user_id: { type: ObjectId, index: true, unique: true },
	groups: [String],
},
{
	perms: {
		admin: "crud",
		user: "r",
	}
});

const UserGroup = Schema.model('Usergroup', UserGroupSchema);
module.exports = UserGroup;