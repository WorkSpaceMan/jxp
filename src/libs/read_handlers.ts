import querystring from "node:querystring";
import type { JXPConfig, JXPRequest, JXPResponse } from "../types/jxp-config";
import type { Model } from "mongoose";

const errors = require("restify-errors");
const query_sanitize = require("./query_sanitize");
const query_limits = require("./query_limits");
const response_sanitize = require("./response_sanitize");
const { safeErrorMessage } = require("./safe_error");
const { logRequestError } = require("./request_log");
const { Parser: CsvParser } = require("@json2csv/plainjs");

function getStripFields(req: JXPRequest): string[] {
	return req.config?.security?.strip_fields || ["password"];
}

function changeUrlParams(req: JXPRequest, key: string, val: unknown): string {
	const q = { ...req.query } as Record<string, unknown>;
	q[key] = val;
	const base = req.config?.server || req.config?.url || "";
	const pathStr = req.path();
	return base + pathStr + "?" + querystring.stringify(q as querystring.ParsedUrlQueryInput);
}

function isISODateString(str: unknown): boolean {
	if (typeof str !== "string") return false;
	const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
	if (!isoDateRegex.test(str)) return false;
	const date = new Date(str);
	if (isNaN(date.getTime())) {
		throw new errors.BadRequestError("Invalid date format");
	}
	return true;
}

export function parseFilter(filter: unknown, depth = 0): Record<string, unknown> {
	const MAX_DEPTH = 10;

	if (!filter) return {};
	if (depth > MAX_DEPTH) {
		throw new errors.BadRequestError("Maximum filter depth exceeded");
	}

	if (typeof filter !== "object" || filter === null) return filter as Record<string, unknown>;

	if (Array.isArray(filter)) {
		const result: Record<string, unknown> = {};
		filter.forEach((item) => {
			if (typeof item === "string" && item.includes(":")) {
				const parts = item.split(":");
				const key = parts[0];
				const value = parts.slice(1).join(":");
				if (key.startsWith("$")) {
					try {
						if (isISODateString(value)) {
							result[key] = new Date(value);
						} else {
							result[key] = value;
						}
					} catch (err) {
						if (err instanceof errors.BadRequestError) throw err;
						throw new errors.BadRequestError("Invalid date format");
					}
				}
			}
		});
		return result;
	}

	const parsedFilter: Record<string, unknown> = {};
	const filterObj = filter as Record<string, unknown>;

	for (const i in filterObj) {
		if (filterObj[i] === "false") {
			parsedFilter[i] = false;
			continue;
		}
		if (filterObj[i] === "true") {
			parsedFilter[i] = true;
			continue;
		}
		if (typeof filterObj[i] === "string") {
			try {
				if (isISODateString(filterObj[i])) {
					parsedFilter[i] = new Date(filterObj[i] as string);
					continue;
				}
			} catch (err) {
				if (err instanceof errors.BadRequestError) throw err;
				throw new errors.BadRequestError("Invalid date format");
			}
			const strVal = filterObj[i] as string;
			if (strVal.includes(":")) {
				const parts = strVal.split(":");
				const key = parts[0];
				const value = parts.slice(1).join(":");
				if (key.startsWith("$")) {
					try {
						if (isISODateString(value)) {
							if (!parsedFilter[i]) parsedFilter[i] = {};
							(parsedFilter[i] as Record<string, unknown>)[key] = new Date(value);
						} else if (value.startsWith("[") && value.endsWith("]")) {
							if (!parsedFilter[i]) parsedFilter[i] = {};
							(parsedFilter[i] as Record<string, unknown>)[key] = value.slice(1, -1).split(",");
						} else if (key === "$regex" && value.startsWith("/")) {
							if (!parsedFilter[i]) parsedFilter[i] = {};
							const match = value.match(/^\/(.+?)\/([gimy]*)$/);
							if (match) {
								(parsedFilter[i] as Record<string, unknown>)[key] = new RegExp(match[1], match[2]);
							}
						} else {
							if (!parsedFilter[i]) parsedFilter[i] = {};
							(parsedFilter[i] as Record<string, unknown>)[key] = value;
						}
					} catch (err) {
						if (err instanceof errors.BadRequestError) throw err;
						throw new errors.BadRequestError("Invalid date format");
					}
				} else {
					parsedFilter[i] = filterObj[i];
				}
			} else {
				parsedFilter[i] = filterObj[i];
			}
		} else if (Array.isArray(filterObj[i])) {
			parsedFilter[i] = parseFilter(filterObj[i], depth + 1);
		} else if (typeof filterObj[i] === "object") {
			parsedFilter[i] = parseFilter(filterObj[i], depth + 1);
		} else {
			parsedFilter[i] = filterObj[i];
		}
	}

	return parsedFilter;
}

export async function getOneDocument(
	Model: Model<unknown>,
	item_id: string,
	params: Record<string, unknown>,
	options: { user?: JXPResponse["user"] }
) {
	const query = Model.findById(item_id, {}, options);
	if (params.populate) {
		if (typeof params.populate === "object" && !Array.isArray(params.populate)) {
			for (const i in params.populate as Record<string, string>) {
				query.populate(i, (params.populate as Record<string, string>)[i].replace(/,/g, " "));
			}
		} else {
			query.populate(params.populate as string);
		}
	}
	if (params.autopopulate) {
		for (const key in Model.schema.paths) {
			const dirpath = Model.schema.paths[key];
			if (dirpath.instance == "ObjectID" && dirpath.options.link) {
				query.populate(
					String(dirpath.options.map_to || dirpath.options.virtual || dirpath.options.link.toLowerCase())
				);
			}
		}
	}
	try {
		const item = await query.exec();
		if (!item) {
			throw new errors.NotFoundError(`Could not find document ${item_id} on ${Model.modelName}`);
		}
		if ((item as { _deleted?: boolean })._deleted && !params.showDeleted) {
			throw new errors.NotFoundError(`Document ${item_id} is deleted on ${Model.modelName}`);
		}
		return response_sanitize.sanitizeDocument(item);
	} catch (err) {
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
}

export async function executeList(req: JXPRequest, res: JXPResponse): Promise<void> {
	let filters: Record<string, unknown> = {};
	try {
		filters = parseFilter(req.query.filter);
		filters = query_sanitize.sanitizeFilter(filters, req.config?.security || {});
	} catch (err) {
		logRequestError(req, res, err, "filter");
		if (err instanceof errors.BadRequestError || err instanceof errors.ForbiddenError) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
	const search = query_sanitize.parseSearchObject(req.query.search);
	for (const i in search) {
		filters[i] = search[i];
	}
	let countquery = filters;
	let qcount = req.Model.find(filters);
	let q = req.Model.find(filters);
	const checkDeleted = [{ _deleted: false }, { _deleted: null }];
	if (!req.query.showDeleted) {
		countquery = Object.assign({ $or: checkDeleted }, countquery);
		qcount.or(checkDeleted);
		q.or(checkDeleted);
	}
	if (req.query.search && typeof req.query.search === "string") {
		q = req.Model.find(
			{ $text: { $search: req.query.search } },
			{ score: { $meta: "textScore" } }
		).sort({ score: { $meta: "textScore" } });
		countquery = Object.assign({ $text: { $search: req.query.search } }, countquery);
		qcount = req.Model.find({ $text: { $search: req.query.search } });
	}
	if (res.user) {
		(q as { options?: { user: typeof res.user } }).options = { user: res.user };
	}
	try {
		const estimatedCount = await req.Model.estimatedDocumentCount();
		const result: Record<string, unknown> = {};
		const { limit: effectiveLimit, limitCapped, filterExemption } = query_limits.enforceListLimit(
			req,
			estimatedCount,
			res,
			{ result, bodyQuery: filters }
		);
		let count = -1;
		if (query_limits.shouldRunCount(req, { filterExemption, limitCapped })) {
			if (estimatedCount < 100000 && Object.keys(countquery).length !== 0) {
				count = await qcount.countDocuments();
			} else {
				count = estimatedCount;
			}
		}
		if (count >= 0) {
			result.count = count;
		}
		query_limits.applyListPagination(q, result, req, effectiveLimit, count >= 0 ? count : 0, changeUrlParams);
		if (req.query.sort) {
			q.sort(req.query.sort as string);
			result.sort = req.query.sort;
		}
		if (req.query.populate) {
			if (typeof req.query.populate === "object" && !Array.isArray(req.query.populate)) {
				for (const i in req.query.populate as Record<string, string>) {
					q.populate(i, (req.query.populate as Record<string, string>)[i].replace(/,/g, " "));
				}
			} else {
				q.populate(req.query.populate as string);
			}
			result.populate = req.query.populate;
		}
		if (req.query.autopopulate) {
			for (const key in req.Model.schema.paths) {
				const dirpath = req.Model.schema.paths[key];
				if (dirpath.instance == "ObjectID" && dirpath.options.link) {
					q.populate(
						String(dirpath.options.map_to || dirpath.options.virtual || dirpath.options.link.toLowerCase())
					);
				}
			}
			result.autopopulate = true;
		}
		if (req.query.fields && typeof req.query.fields === "string") {
			const fields = req.query.fields.split(",");
			const select: Record<string, number> = {};
			fields.forEach((field) => {
				select[field] = 1;
			});
			q.select(select);
		}
		if (req.query.search) {
			result.search = req.query.search;
		}
		result.data = await q.exec();
		response_sanitize.sanitizeListResult(result, getStripFields(req));
		query_limits.finalizeListPagination(
			result,
			req,
			Array.isArray(result.data) ? result.data.length : 0,
			effectiveLimit,
			count,
			changeUrlParams
		);
		query_limits.enforceResponseSize(result, req, res);
		res.result = result;
	} catch (err) {
		if (
			!(err instanceof errors.BadRequestError) &&
			!(err instanceof errors.ForbiddenError) &&
			!(err instanceof errors.PayloadTooLargeError)
		) {
			logRequestError(req, res, err, "get");
		}
		if (err instanceof errors.BadRequestError) throw err;
		if (err instanceof errors.ForbiddenError) throw err;
		if (err instanceof errors.PayloadTooLargeError) throw err;
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
}

export async function executeGetOne(req: JXPRequest, res: JXPResponse): Promise<void> {
	try {
		const data = await getOneDocument(req.Model, req.params.item_id, req.query, { user: res.user });
		res.result = { data };
	} catch (err) {
		logRequestError(req, res, err, "getOne");
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
}

export async function executeCount(req: JXPRequest, res: JXPResponse): Promise<void> {
	let filters: Record<string, unknown> = {};
	try {
		filters = parseFilter(req.query.filter);
		filters = query_sanitize.sanitizeFilter(filters, req.config?.security || {});
	} catch (err) {
		logRequestError(req, res, err, "filter");
		if (err instanceof errors.BadRequestError || err instanceof errors.ForbiddenError) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
	const search = query_sanitize.parseSearchObject(req.query.search);
	for (const i in search) {
		filters[i] = search[i];
	}
	if (!req.query.showDeleted) {
		filters = Object.assign({ $or: [{ _deleted: false }, { _deleted: null }] }, filters);
	}
	try {
		const count = await req.Model.countDocuments(filters).exec();
		res.result = { count };
	} catch (err) {
		logRequestError(req, res, err, "count");
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
}

export function resultToCsv(result: Record<string, unknown>): string {
	if (!result.data || !Array.isArray(result.data) || !result.data.length) {
		throw new errors.BadRequestError("No data to export");
	}
	const opts = { flatten: true };
	const data = result.data.map((row: { _doc?: unknown }) => row._doc || row);
	return new CsvParser(opts).parse(data);
}

export function buildSyntheticRequest(
	config: JXPConfig,
	modelname: string,
	Model: Model<unknown>,
	query: Record<string, unknown>,
	params: Record<string, string> = {}
): JXPRequest {
	return {
		params,
		query,
		headers: {},
		method: "GET",
		modelname,
		Model,
		config,
		path: () => `/api/${modelname}`,
	};
}

export function buildSyntheticResponse(user: JXPResponse["user"], groups: string[]): JXPResponse {
	return {
		user,
		groups,
		header: () => undefined,
		status: function () {
			return this;
		},
		send: () => undefined,
		json: () => undefined,
		redirect: () => undefined,
		writeHead: () => undefined,
		write: () => undefined,
		end: () => undefined,
	};
}
