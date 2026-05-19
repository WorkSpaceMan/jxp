import type { SchemaDefinitionProperty, SchemaTypeOptions } from "mongoose";

/** JXP field extensions on top of Mongoose schema types. */
export interface JXPFieldDefinition extends SchemaTypeOptions<unknown> {
	link?: string;
	map_to?: string;
	virtual?: string;
	justOne?: boolean;
	alias?: string;
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
