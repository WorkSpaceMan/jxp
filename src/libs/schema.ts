import mongoose, { type Model, type SchemaDefinition } from "mongoose";
import path from "path";
import JXPHelper = require("jxp-helper");
import modeldir = require("./modeldir");
import { getModelDirFromEnv } from "./load-config";
import type { JXPDefinition, JXPSchemaOptions } from "../types/schema-fields";

// Set some global types for JS model files using /* global ObjectId Mixed */
global.ObjectId = mongoose.Schema.Types.ObjectId;
global.Mixed = mongoose.Schema.Types.Mixed;

function resolveModelDir(dir: string): string {
	if (path.isAbsolute(dir)) return dir;
	return path.resolve(process.cwd(), dir);
}

function getModelDir(): string {
	const fromEnv = getModelDirFromEnv();
	if (fromEnv) return resolveModelDir(fromEnv);
	return modeldir.findModelDir(path.dirname(process.argv[1] ?? "."));
}

const getModelFileFromRef = (ref: string): string => {
	return path.join(getModelDir(), `${String(ref).toLowerCase()}_model`);
};

interface JXPFieldWithLink {
	link?: string;
	map_to?: string;
	virtual?: string;
	justOne?: boolean;
	options?: Record<string, unknown>;
	0?: JXPFieldWithLink;
}

class JXPSchema extends mongoose.Schema {
	declare opts: JXPSchemaOptions;
	declare definition: JXPDefinition;

	constructor(definition: JXPDefinition, opts: JXPSchemaOptions = {}) {
		opts = Object.assign(
			{
				timestamps: true,
				toJSON: { virtuals: true },
				toObject: { virtuals: true },
			},
			opts
		);
		definition = Object.assign(
			{
				_deleted: { type: Boolean, default: false, index: true },
				_owner_id: { type: global.ObjectId, link: "User", map_to: "_owner", index: true },
				_updated_by_id: { type: global.ObjectId, link: "User", map_to: "_updated_by", index: true },
			},
			definition
		);
		if (!global.jxphelper) {
			const jxp_settings: { apikey?: string; server?: string } = {};
			if (global.apikey) jxp_settings.apikey = global.apikey;
			if (global.server) jxp_settings.server = global.server;
			if (jxp_settings.apikey && jxp_settings.server) {
				global.jxphelper = new JXPHelper(jxp_settings);
			}
		}
		super(definition as SchemaDefinition, opts);
		this.opts = opts;
		this.definition = definition;
		this.index({ createdAt: -1 });
		this.index({ updatedAt: -1 });
		this.setPerms();
		this.generateLinks();
	}

	setPerms(): void {
		// JXP stores permission strings on the schema for runtime auth checks
		(this as unknown as { set: (k: string, v: unknown) => void }).set(
			"_perms",
			Object.assign(
				{
					admin: "",
					owner: "",
					user: "",
					all: "",
				},
				this.opts.perms
			)
		);
	}

	generateLinks(): void {
		const loaded_files: string[] = [];
		for (const key of Object.keys(this.definition)) {
			let def = this.definition[key] as JXPFieldWithLink | JXPFieldWithLink[];
			let is_array = false;
			if (Array.isArray(def) && def[0]) {
				def = def[0];
				is_array = true;
			}
			if (!def || typeof def !== "object" || !("link" in def) || !def.link) continue;
			const virtual_name = def.map_to || def.virtual || String(def.link).toLowerCase();
			if (!loaded_files.includes(def.link)) {
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				const linked = require(getModelFileFromRef(def.link));
				void (linked.default || linked);
				loaded_files.push(def.link);
			}
			this.virtual(virtual_name, {
				ref: def.link,
				localField: key,
				foreignField: "_id",
				justOne: def.justOne ?? !is_array,
				options: Object.assign({}, def.options),
			});
		}
	}

	static Types = mongoose.Schema.Types;
	static model = mongoose.model.bind(mongoose) as <T>(
		name: string,
		schema?: JXPSchema,
		collection?: string
	) => Model<T>;
}

export type { JXPSchema };
export default JXPSchema;
