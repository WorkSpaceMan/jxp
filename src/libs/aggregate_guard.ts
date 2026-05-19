const errors = require("restify-errors");

const DEFAULT_ALLOWED_STAGES = new Set([
	"$match",
	"$group",
	"$lookup",
	"$project",
	"$sort",
	"$limit",
	"$skip",
	"$unwind",
	"$addFields",
	"$set",
	"$count",
	"$facet",
	"$bucket",
	"$bucketAuto",
	"$sample",
	"$replaceRoot",
	"$replaceWith",
	"$redact",
]);

const ADMIN_ONLY_STAGES = new Set(["$out", "$merge", "$function"]);

function getAllowedStages(custom?: string[]): Set<string> {
	if (!custom || !custom.length) return DEFAULT_ALLOWED_STAGES;
	return new Set(custom);
}

function stageKeys(stage: unknown): string[] {
	if (!stage || typeof stage !== "object" || Array.isArray(stage)) return [];
	return Object.keys(stage as Record<string, unknown>).filter((k) => k.startsWith("$"));
}

export function validatePipeline(
	pipeline: unknown[],
	options?: { aggregate_stages_allow?: string[]; isAdmin?: boolean }
): void {
	if (!Array.isArray(pipeline)) {
		throw new errors.BadRequestError("Aggregation pipeline must be an array");
	}
	const allowed = getAllowedStages(options?.aggregate_stages_allow);
	const isAdmin = options?.isAdmin === true;

	for (const stage of pipeline) {
		const keys = stageKeys(stage);
		for (const key of keys) {
			if (ADMIN_ONLY_STAGES.has(key) && !isAdmin) {
				throw new errors.ForbiddenError(`Aggregation stage ${key} requires admin`);
			}
			if (!allowed.has(key) && !ADMIN_ONLY_STAGES.has(key)) {
				throw new errors.BadRequestError(`Aggregation stage ${key} is not allowed`);
			}
		}
	}
}

module.exports = {
	validatePipeline,
	DEFAULT_ALLOWED_STAGES: [...DEFAULT_ALLOWED_STAGES],
};
