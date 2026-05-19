import errors from "restify-errors";
import JXPSchema from "../libs/schema";
import type { Types } from "mongoose";

export interface ITest {
	_id?: Types.ObjectId;
	foo?: string;
	bar?: string;
	user_id?: Types.ObjectId;
	yack?: unknown;
	shmack?: string[];
	password?: string;
	fulltext?: string;
	link_id?: Types.ObjectId;
	other_link_id?: Types.ObjectId;
	string_array?: string[];
	array_link_id?: Types.ObjectId[];
	composite_array?: { afoo?: string; abar?: number }[];
	mixed_array?: unknown[];
	date_field?: Date;
}

const TestSchema = new JXPSchema(
	{
		foo: String,
		bar: { type: String, unique: true, index: true, default: "Some Default" },
		user_id: { type: global.ObjectId, link: "User" },
		yack: global.Mixed,
		shmack: [String],
		password: String,
		fulltext: { type: String, index: { text: true } },
		link_id: { type: global.ObjectId, link: "Link" },
		other_link_id: { type: global.ObjectId, link: "Link", map_to: "other_link" },
		string_array: [String],
		array_link_id: [{ type: global.ObjectId, link: "Link", map_to: "array_link", justOne: false }],
		composite_array: [{ afoo: String, abar: Number }],
		mixed_array: [global.Mixed],
		date_field: { type: Date, index: true },
	},
	{
		perms: {
			admin: "crud",
			owner: "crud",
			user: "cr",
			all: "r",
		},
		callable_statics: ["test"],
		advanced_queries: { query: true, aggregate: true, bulkwrite: true },
	}
);

TestSchema.statics.test = function () {
	return "Testing OKAY!";
};

TestSchema.pre("save", function (next) {
	if (this.bar == "Throw an error") {
		throw new errors.ImATeapotError("I'm a teapot");
	}
	next();
});

const Test = JXPSchema.model<ITest>("Test", TestSchema);
export default Test;
