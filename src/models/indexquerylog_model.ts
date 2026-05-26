import JXPSchema from "../libs/schema";
import { getIndexQueryLogRetentionSeconds } from "../libs/load-config";
import type { Types } from "mongoose";

export interface IIndexQueryLog {
	_id?: Types.ObjectId;
	model_name: string;
	op: string;
	filter_summary: string;
	severity: "alert" | "warn";
	reason?: string;
	stage?: string;
	total_docs_examined?: number;
	n_returned?: number;
	total_keys_examined?: number;
	millis?: number;
	observed_at?: Date;
	createdAt?: Date;
}

const IndexQueryLogSchema = new JXPSchema(
	{
		model_name: { type: String, required: true, index: true },
		op: { type: String, required: true },
		filter_summary: { type: String, default: "{}" },
		severity: { type: String, required: true, index: true },
		reason: String,
		stage: String,
		total_docs_examined: Number,
		n_returned: Number,
		total_keys_examined: Number,
		millis: Number,
		observed_at: { type: Date, default: Date.now, index: true },
	},
	{
		internal: true,
		perms: {
			admin: "crud",
			owner: "",
			user: "",
		},
	}
);

IndexQueryLogSchema.index(
	{ observed_at: 1 },
	{ expireAfterSeconds: getIndexQueryLogRetentionSeconds() }
);
IndexQueryLogSchema.index({ model_name: 1, severity: 1, observed_at: -1 });

const IndexQueryLog = JXPSchema.model<IIndexQueryLog>("IndexQueryLog", IndexQueryLogSchema);
export default IndexQueryLog;
