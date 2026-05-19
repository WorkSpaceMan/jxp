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

module.exports = {
	validateBulkOps,
	DEFAULT_ALLOWED_OPS: [...DEFAULT_ALLOWED_OPS],
};
