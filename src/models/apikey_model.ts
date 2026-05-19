import JXPSchema from "../libs/schema";
import type { Types } from "mongoose";

export interface IAPIKey {
	_id?: Types.ObjectId;
	user_id?: Types.ObjectId;
	apikey?: string;
	last_accessed?: Date;
}

const APIKeySchema = new JXPSchema({
	user_id: { type: global.ObjectId, index: true, unique: true },
	apikey: { type: String, index: true, unique: true },
	last_accessed: { type: Date, default: Date.now, index: true },
});

const APIKey = JXPSchema.model<IAPIKey>("APIKey", APIKeySchema);
export default APIKey;
