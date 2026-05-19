const errors = require("restify-errors");

const DEFAULTS = {
	enabled: true,
	large_collection_threshold: 10000,
	max: 1000,
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
	const n = parseInt(req.query.limit, 10);
	return Number.isFinite(n) && n > 0 ? n : null;
}

function enforceListLimit(req, estimatedCount) {
	const limits = getLimits(req);
	if (limits.enabled === false) {
		return parseRequestedLimit(req);
	}

	const requested = parseRequestedLimit(req);
	const isLarge = estimatedCount >= limits.large_collection_threshold;

	if (isLarge && !requested) {
		throw new errors.BadRequestError(
			`Collection "${req.modelname}" has ~${estimatedCount} documents. ` +
			`Use ?limit=1..${limits.max} (required). For totals use GET /count/${req.modelname}.`
		);
	}

	if (requested && requested > limits.max) {
		throw new errors.BadRequestError(
			`?limit=${requested} exceeds maximum ${limits.max} for "${req.modelname}".`
		);
	}

	return requested;
}

function applyListPagination(q, result, req, limit, count, changeUrlParams) {
	if (!limit) {
		return;
	}
	q.limit(limit);
	result.limit = limit;
	const page_count = Math.ceil(count / limit);
	result.page_count = page_count;
	let page = parseInt(req.query.page, 10);
	page = page ? page : 1;
	result.page = page;
	if (page < page_count) {
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
	enforceListLimit,
	applyListPagination,
	DEFAULTS,
};
