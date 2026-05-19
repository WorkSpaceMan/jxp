const errors = require("restify-errors");
import type { Model } from "mongoose";

export function assertCallableStatic(Model: Model<unknown>, methodName: string): void {
	const opts = (Model.schema as { opts?: { callable_statics?: string[] } }).opts;
	const allowed = opts?.callable_statics;
	if (!Array.isArray(allowed) || !allowed.includes(methodName)) {
		throw new errors.ForbiddenError(`Method ${methodName} is not callable via API`);
	}
	const fn = (Model as unknown as Record<string, unknown>)[methodName];
	if (typeof fn !== "function") {
		throw new errors.NotFoundError(`Method ${methodName} not found on model`);
	}
}

module.exports = { assertCallableStatic };
