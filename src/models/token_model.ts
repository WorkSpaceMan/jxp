import JXPSchema from "../libs/schema";
import { getTokenExpiry } from "../libs/load-config";
import type { Types } from "mongoose";

export interface IToken {
	_id?: Types.ObjectId;
	user_id?: Types.ObjectId;
	provider?: string;
	access_token?: string;
	token_type?: string;
	expires_in?: number;
	last_accessed?: Date;
	createdAt?: Date;
}

const TokenSchema = new JXPSchema(
	{
		user_id: { type: global.ObjectId, index: true },
		provider: String,
		access_token: { type: String, index: true },
		token_type: String,
		expires_in: { type: Number, default: getTokenExpiry(), required: true },
		last_accessed: { type: Date, default: Date.now, index: true },
	},
	{
		perms: {
			admin: "crud",
			owner: "crud",
			user: "",
		},
	}
);

TokenSchema.index({ expire_at: 1 }, { expireAfterSeconds: getTokenExpiry() });

const Token = JXPSchema.model<IToken>("Token", TokenSchema);
export default Token;
