import type { SchemaDefinitionProperty, SchemaTypeOptions } from "mongoose";

/** JXP field extensions on top of Mongoose schema types. */
export interface JXPFieldDefinition extends SchemaTypeOptions<unknown> {
	link?: string;
	map_to?: string;
	virtual?: string;
	justOne?: boolean;
	alias?: string;
}

export interface JXPAdvancedQueries {
	query?: boolean;
	aggregate?: boolean;
	bulkwrite?: boolean;
}

export interface JXPSchemaOptions {
	perms?: Partial<Record<"admin" | "owner" | "user" | "all" | string, string>>;
	timestamps?: boolean;
	toJSON?: { virtuals?: boolean };
	toObject?: { virtuals?: boolean };
	query_limits?: {
		enabled?: boolean;
		large_collection_threshold?: number;
		max?: number;
	};
	/** Static method names exposed via GET/POST /call/:modelname/:method_name */
	callable_statics?: string[];
	/** Opt out of HTTP advanced endpoints per model (default: query/aggregate on, bulkwrite off) */
	advanced_queries?: JXPAdvancedQueries;
	[key: string]: unknown;
}

export type JXPDefinition = Record<
	string,
	| JXPFieldDefinition
	| JXPFieldDefinition[]
	| SchemaDefinitionProperty<unknown>
	| SchemaDefinitionProperty<unknown>[]
>;

export interface JXPPerms {
	admin: string;
	owner: string;
	user: string;
	all: string;
	[key: string]: string;
}
