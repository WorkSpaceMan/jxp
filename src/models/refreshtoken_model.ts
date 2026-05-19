import JXPSchema from "../libs/schema";
import { getRefreshTokenExpiry } from "../libs/load-config";
import type { Types } from "mongoose";

export interface IRefreshToken {
	_id?: Types.ObjectId;
	user_id?: Types.ObjectId;
	refresh_token?: string;
	expires_in?: number;
	createdAt?: Date;
}

const RefreshTokenSchema = new JXPSchema(
	{
		user_id: { type: global.ObjectId, index: true },
		refresh_token: { type: String, index: true },
		expires_in: { type: Number, default: getRefreshTokenExpiry() },
	},
	{
		perms: {
			admin: "crud",
			owner: "crud",
			user: "",
		},
	}
);

RefreshTokenSchema.index(
	{ expire_at: 1 },
	{ expireAfterSeconds: getRefreshTokenExpiry() }
);

const RefreshToken = JXPSchema.model<IRefreshToken>("RefreshToken", RefreshTokenSchema);
export default RefreshToken;
