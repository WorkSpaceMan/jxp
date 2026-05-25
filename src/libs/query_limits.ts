const errors = require("restify-errors");
const { logRequestError } = require("./request_log");

const DEFAULTS = {
	enabled: true,
	large_collection_threshold: 10000,
	max: 1000,
	default: 100,
	require_limit_always: true,
	skip_count_unless_paginated: true,
};

function getLimits(req) {
	const limits = Object.assign({}, DEFAULTS, req.config?.query_limits);
	const modelLimits = req.Model?.schema?.opts?.query_limits;
	if (modelLimits && typeof modelLimits === "object") {
		Object.assign(limits, modelLimits);
	}
	return limits;
}

function parseRequestedLimit(req) {
	const n = parseInt(String(req.query.limit ?? ""), 10);
	return Number.isFinite(n) && n > 0 ? n : null;
}

function shouldRunCount(req) {
	const limits = getLimits(req);
	if (limits.skip_count_unless_paginated === false) return true;
	if (req.query.count === "true" || req.query.count === true) return true;
	const page = parseInt(String(req.query.page ?? ""), 10);
	return Number.isFinite(page) && page > 0;
}

function enforceListLimit(req, estimatedCount, res?) {
	const limits = getLimits(req);
	if (limits.enabled === false) {
		return parseRequestedLimit(req);
	}

	const requested = parseRequestedLimit(req);
	const isLarge = estimatedCount >= limits.large_collection_threshold;
	const sizeHint = `~${estimatedCount} docs threshold=${limits.large_collection_threshold}`;

	if (isLarge && !requested && limits.require_limit_always !== false) {
		const err = new errors.BadRequestError(
			`Collection "${req.modelname}" has ~${estimatedCount} documents. ` +
				`Use ?limit=1..${limits.max} (required). For totals use GET /count/${req.modelname}.`
		);
		logRequestError(req, res, err, "query_limit", sizeHint);
		throw err;
	}

	if (requested && requested > limits.max) {
		const err = new errors.BadRequestError(
			`?limit=${requested} exceeds maximum ${limits.max} for "${req.modelname}".`
		);
		logRequestError(req, res, err, "query_limit", sizeHint);
		throw err;
	}

	if (requested) {
		return requested;
	}

	if (limits.require_limit_always !== false && limits.default) {
		return limits.default;
	}

	return null;
}

function applyListPagination(q, result, req, limit, count, changeUrlParams) {
	if (!limit) {
		return;
	}
	q.limit(limit);
	result.limit = limit;
	const page_count = count >= 0 ? Math.ceil(count / limit) : null;
	if (page_count !== null) {
		result.page_count = page_count;
	}
	let page = parseInt(String(req.query.page ?? ""), 10);
	page = page ? page : 1;
	result.page = page;
	if (page_count !== null && page < page_count) {
		result.next = changeUrlParams(req, "page", page + 1);
	}
	if (page > 1) {
		result.prev = changeUrlParams(req, "page", page - 1);
		q.skip(limit * (page - 1));
	}
}

module.exports = {
	getLimits,
	parseRequestedLimit,
	shouldRunCount,
	enforceListLimit,
	applyListPagination,
	DEFAULTS,
};
