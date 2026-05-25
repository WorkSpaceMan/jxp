const errors = require("restify-errors");

const DEFAULT_ALLOWED_OPS = new Set([
	"insertOne",
	"updateOne",
	"replaceOne",
	"deleteOne",
]);

const ADMIN_ONLY_OPS = new Set(["updateMany", "deleteMany"]);

function getAllowedOps(custom?: string[]): Set<string> {
	if (!custom || !custom.length) return DEFAULT_ALLOWED_OPS;
	return new Set(custom);
}

export function validateBulkOps(
	ops: unknown[],
	options?: { bulk_operations_allow?: string[]; isAdmin?: boolean }
): void {
	if (!Array.isArray(ops)) {
		throw new errors.BadRequestError("Bulk write operations must be an array");
	}
	const allowed = getAllowedOps(options?.bulk_operations_allow);
	const isAdmin = options?.isAdmin === true;

	for (const op of ops) {
		if (!op || typeof op !== "object") {
			throw new errors.BadRequestError("Invalid bulk write operation");
		}
		const keys = Object.keys(op as Record<string, unknown>);
		if (keys.length !== 1) {
			throw new errors.BadRequestError("Each bulk write entry must have exactly one operation");
		}
		const opName = keys[0];
		if (ADMIN_ONLY_OPS.has(opName) && !isAdmin) {
			throw new errors.ForbiddenError(`Bulk operation ${opName} requires admin`);
		}
		if (!allowed.has(opName) && !ADMIN_ONLY_OPS.has(opName)) {
			throw new errors.BadRequestError(`Bulk operation ${opName} is not allowed`);
		}
	}
}

function permsForBulkEntry(opName: string, payload: unknown): string[] {
	if (!payload || typeof payload !== "object") {
		throw new errors.BadRequestError("Invalid bulk write operation payload");
	}
	const p = payload as Record<string, unknown>;

	switch (opName) {
		case "insertOne":
			return ["c"];
		case "deleteOne":
		case "deleteMany":
			return ["d"];
		case "updateOne":
		case "updateMany":
		case "replaceOne":
			return p.upsert === true ? ["c", "u"] : ["u"];
		default:
			throw new errors.BadRequestError(`Bulk operation ${opName} is not allowed`);
	}
}

export function requiredPermsForBulkOps(ops: unknown[]): Set<string> {
	if (!Array.isArray(ops)) {
		throw new errors.BadRequestError("Bulk write operations must be an array");
	}
	const required = new Set<string>();
	for (const op of ops) {
		if (!op || typeof op !== "object") {
			throw new errors.BadRequestError("Invalid bulk write operation");
		}
		const keys = Object.keys(op as Record<string, unknown>);
		if (keys.length !== 1) {
			throw new errors.BadRequestError("Each bulk write entry must have exactly one operation");
		}
		const opName = keys[0];
		const perms = permsForBulkEntry(opName, (op as Record<string, unknown>)[opName]);
		for (const perm of perms) {
			required.add(perm);
		}
	}
	return required;
}

module.exports = {
	validateBulkOps,
	requiredPermsForBulkOps,
	permsForBulkEntry,
	DEFAULT_ALLOWED_OPS: [...DEFAULT_ALLOWED_OPS],
};
