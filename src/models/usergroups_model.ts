import JXPSchema from "../libs/schema";
import type { Types } from "mongoose";

export interface IUserGroup {
	_id?: Types.ObjectId;
	user_id?: Types.ObjectId;
	groups?: string[];
}

const UserGroupSchema = new JXPSchema(
	{
		user_id: { type: global.ObjectId, index: true, unique: true, link: "User" },
		groups: [String],
	},
	{
		perms: {
			admin: "crud",
			user: "r",
		},
	}
);

const UserGroup = JXPSchema.model<IUserGroup>("Usergroup", UserGroupSchema);
export default UserGroup;
