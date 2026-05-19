import type JXPSchemaClass from "./libs/schema";
import type { Schema } from "mongoose";
import type JXPHelper from "jxp-helper";

declare global {
	// eslint-disable-next-line no-var
	var JXPSchema: typeof JXPSchemaClass;
	// eslint-disable-next-line no-var
	var ObjectId: typeof Schema.Types.ObjectId;
	// eslint-disable-next-line no-var
	var Mixed: typeof Schema.Types.Mixed;
	// eslint-disable-next-line no-var
	var jxphelper: InstanceType<typeof JXPHelper> | undefined;
	// eslint-disable-next-line no-var
	var apikey: string | undefined;
	// eslint-disable-next-line no-var
	var server: string | undefined;
	// eslint-disable-next-line no-var
	var model_dir: string | undefined;
}

export {};
