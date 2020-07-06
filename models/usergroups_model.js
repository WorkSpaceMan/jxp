/* global JXPSchema ObjectId */

var UserGroupSchema = new JXPSchema({
	user_id: { type: ObjectId, index: true, unique: true, link: "User" },
	groups: [String],
},
{
	perms: {
		admin: "crud",
		user: "r",
	}
});

const UserGroup = JXPSchema.model('Usergroup', UserGroupSchema);
module.exports = UserGroup;