const errors = require("restify-errors");
const { logRequestError } = require("./request_log");
const { parseByteSize } = require("./parse_byte_size");

interface CountOpts {
	filterExemption?: boolean;
	limitCapped?: boolean;
}

interface LimitOpts {
	result?: Record<string, unknown>;
	bodyQuery?: Record<string, unknown>;
}

interface QueryLimitsConfig {
	enabled: boolean;
	large_collection_threshold: number;
	max: number;
	default: number;
	require_limit_always: boolean;
	skip_count_unless_paginated: boolean;
	max_response_size?: string | number;
	max_response_bytes: number;
}

const DEFAULT_MAX_RESPONSE_SIZE = "10mb";
const DEFAULT_MAX_RESPONSE_BYTES = parseByteSize(DEFAULT_MAX_RESPONSE_SIZE, "query_limits.max_response_size");

const DEFAULTS: Omit<QueryLimitsConfig, "max_response_bytes" | "max_response_size"> = {
	enabled: true,
	large_collection_threshold: 10000,
	max: 1000,
	default: 100,
	require_limit_always: true,
	skip_count_unless_paginated: true,
};

function resolveMaxResponseBytes(limits: Record<string, unknown>) {
	const raw = limits.max_response_size ?? limits.max_response_bytes ?? DEFAULT_MAX_RESPONSE_SIZE;
	try {
		return parseByteSize(raw as string | number, "query_limits.max_response_size");
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new errors.BadRequestError(message);
	}
}

function getLimits(req): QueryLimitsConfig {
	const limits = Object.assign({}, DEFAULTS, req.config?.query_limits) as QueryLimitsConfig & Record<string, unknown>;
	const modelLimits = req.Model?.schema?.opts?.query_limits;
	if (modelLimits && typeof modelLimits === "object") {
		Object.assign(limits, modelLimits);
	}
	limits.max_response_bytes = resolveMaxResponseBytes(limits);
	return limits;
}

function parseRequestedLimit(req) {
	const n = parseInt(String(req.query.limit ?? ""), 10);
	return Number.isFinite(n) && n > 0 ? n : null;
}

function hasMeaningfulFilter(filter) {
	if (filter == null || filter === "") {
		return false;
	}
	if (typeof filter === "object" && !Array.isArray(filter)) {
		return Object.keys(filter).length > 0;
	}
	return true;
}

/** GET ?filter= or non-empty POST /query body query */
function hasClientFilter(req, bodyQuery?) {
	if (hasMeaningfulFilter(bodyQuery)) {
		return true;
	}
	return hasMeaningfulFilter(req.query?.filter);
}

function shouldRunCount(req, opts: CountOpts = {}) {
	const limits = getLimits(req);
	if (limits.skip_count_unless_paginated === false) return true;
	if (req.query.count === "true" || req.query.count === true) return true;
	const page = parseInt(String(req.query.page ?? ""), 10);
	if (Number.isFinite(page) && page > 0) return true;
	if (opts.filterExemption || opts.limitCapped) return true;
	return false;
}

function enforceListLimit(req, estimatedCount, res?, opts: LimitOpts = {}) {
	const limits = getLimits(req);
	const result = opts.result;
	const hasFilter = hasClientFilter(req, opts.bodyQuery);

	if (limits.enabled === false) {
		return { limit: parseRequestedLimit(req), limitCapped: false, filterExemption: false };
	}

	const requested = parseRequestedLimit(req);
	const isLarge = estimatedCount >= limits.large_collection_threshold;
	const sizeHint = `~${estimatedCount} docs threshold=${limits.large_collection_threshold}`;
	let limitCapped = false;
	let filterExemption = false;

	if (isLarge && !requested && limits.require_limit_always !== false && !hasFilter) {
		const err = new errors.BadRequestError(
			`Collection "${req.modelname}" has ~${estimatedCount} documents. ` +
				`Use ?limit=1..${limits.max} (required). For totals use GET /count/${req.modelname}.`
		);
		logRequestError(req, res, err, "query_limit", sizeHint);
		throw err;
	}

	if (isLarge && !requested && hasFilter) {
		filterExemption = true;
	}

	let effectiveLimit;
	if (requested && requested > limits.max) {
		effectiveLimit = limits.max;
		limitCapped = true;
		if (result) {
			result.limit_capped = true;
		}
	} else if (requested) {
		effectiveLimit = requested;
	} else if (limits.require_limit_always !== false && limits.default) {
		effectiveLimit = limits.default;
	} else {
		effectiveLimit = null;
	}

	return { limit: effectiveLimit, limitCapped, filterExemption };
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

function finalizeListPagination(result, req, dataLength, limit, count, changeUrlParams) {
	if (!limit || dataLength !== limit) {
		return;
	}
	const page = typeof result.page === "number" ? result.page : 1;
	if (count >= 0) {
		const page_count = Math.ceil(count / limit);
		if (page < page_count && !result.next) {
			result.next = changeUrlParams(req, "page", page + 1);
		}
		return;
	}
	result.has_more = true;
	if (!result.next) {
		result.next = changeUrlParams(req, "page", page + 1);
	}
}

function responseByteSize(payload) {
	return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

function enforceResponseSize(result, req, res?) {
	const limits = getLimits(req);
	const maxBytes = limits.max_response_bytes;
	if (!maxBytes || maxBytes <= 0) {
		return;
	}
	const size = responseByteSize(result);
	if (size > maxBytes) {
		const err = new errors.PayloadTooLargeError(
			`Response size ${size} bytes exceeds maximum ${maxBytes} bytes for "${req.modelname}". ` +
				`Reduce ?limit=, use ?fields=, or paginate.`
		);
		logRequestError(req, res, err, "response_size", `${size}B max=${maxBytes}B`);
		throw err;
	}
}

module.exports = {
	getLimits,
	parseRequestedLimit,
	hasClientFilter,
	hasMeaningfulFilter,
	shouldRunCount,
	enforceListLimit,
	applyListPagination,
	finalizeListPagination,
	enforceResponseSize,
	responseByteSize,
	DEFAULTS,
};
