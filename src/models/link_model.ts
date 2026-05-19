import JXPSchema from "../libs/schema";
import type { Types } from "mongoose";

export interface ILink {
	_id?: Types.ObjectId;
	name?: string;
	val?: string;
}

const LinkSchema = new JXPSchema(
	{
		name: String,
		val: String,
	},
	{
		perms: {
			admin: "crud",
			owner: "crud",
			user: "cr",
			all: "r",
		},
	}
);

const Link = JXPSchema.model<ILink>("Link", LinkSchema);
export default Link;
