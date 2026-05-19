declare module "mongoose-friendly" {
	import type { Schema } from "mongoose";
	function friendly(schema: Schema, options: { source: string; friendly: string }): void;
	export = friendly;
}
