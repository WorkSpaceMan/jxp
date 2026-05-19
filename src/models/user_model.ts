import friendly from "mongoose-friendly";
import JXPSchema from "../libs/schema";
import type { Types } from "mongoose";

export interface IUser {
	_id?: Types.ObjectId;
	name?: string;
	urlid?: string;
	email?: string;
	password?: string;
	admin?: boolean;
	temp_hash?: string;
	createdAt?: Date;
	updatedAt?: Date;
}

function toLower(v: string | null | undefined): string | null {
	if (v) return v.toLowerCase();
	return null;
}

const UserSchema = new JXPSchema(
	{
		name: { type: String },
		urlid: { type: String, unique: true, index: true },
		email: { type: String, unique: true, index: true, set: toLower },
		password: String,
		admin: Boolean,
		temp_hash: String,
	},
	{
		perms: {
			admin: "crud",
			owner: "cru",
			user: "r",
			member: "r",
			api: "r",
		},
	}
);

UserSchema.path("name").validate(function (v: string) {
	return v && v.length > 0;
}, "Name cannot be empty");

UserSchema.plugin(friendly, {
	source: "name",
	friendly: "urlid",
});

const User = JXPSchema.model<IUser>("User", UserSchema);
export default User;
