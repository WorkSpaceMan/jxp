import type { JXPConfig } from "../types/jxp-config";

const errors = require("restify-errors");
const restify = require("restify");
const path = require("path");
const security = require("./security");
const datamunging = require("./datamunging");
const login = require("./login");
const groups = require("./groups");
const setup = require("./setup");
const Docs = require("./docs");
const docsAuth = require("./docs-auth");
const loginRateLimit = require("./login_rate_limit");
const querystring = require("node:querystring");
const fs = require("fs");
const morgan = require("morgan");
const ws = require("./ws");
const modeldir = require("./modeldir");
const query_manipulation = require("./query_manipulation");
const corsMiddleware = require('restify-cors-middleware2');
const { Parser: CsvParser } = require('@json2csv/plainjs');
const cache = require("./cache");
const query_limits = require("./query_limits");
const query_sanitize = require("./query_sanitize");
const aggregate_guard = require("./aggregate_guard");
const bulkwrite_guard = require("./bulkwrite_guard");
const call_guard = require("./call_guard");
const response_sanitize = require("./response_sanitize");
const link_index = require("./link_index");
const { safeErrorMessage } = require("./safe_error");
const { logRequestError, logAndThrow } = require("./request_log");
const index_diagnostics = require("./index_diagnostics");
const builtin_models = require("./builtin_models");
const schemaModule = require("./schema");
global.JXPSchema = schemaModule.default || schemaModule;

var models = {};

var ops = 0;

var debug = false;

const USER_PRIVILEGE_FIELDS = ["admin", "password", "groups"];

function getStripFields(req) {
	return req.config?.security?.strip_fields || ["password"];
}

function getSecurityOpts(req) {
	return req.config?.security || {};
}

function advancedQueryAllowed(Model, kind, options?: { isAdmin?: boolean }) {
	const opts = (Model.schema as { opts?: { advanced_queries?: Record<string, boolean> } }).opts;
	const aq = opts?.advanced_queries;
	if (kind === "bulkwrite") {
		if (options?.isAdmin) return true;
		return aq?.bulkwrite === true;
	}
	if (kind === "aggregate") {
		return aq?.aggregate !== false;
	}
	return aq?.query !== false;
}

const middlewareBulkWriteAllowed = (req, res, next) => {
	if (!advancedQueryAllowed(req.Model, "bulkwrite", { isAdmin: !!res.user?.admin })) {
		const err = new errors.ForbiddenError(
			`POST /bulkwrite is disabled for model ${req.modelname}`
		);
		logRequestError(req, res, err, "bulkwrite disabled");
		return next(err);
	}
	next();
};

const middlewareAdvancedQueryAllowed = (kind: "query" | "aggregate") => {
	return (req, res, next) => {
		if (!advancedQueryAllowed(req.Model, kind)) {
			const err = new errors.ForbiddenError(
				`POST /${kind} is disabled for model ${req.modelname}`
			);
			logRequestError(req, res, err, `${kind} disabled`);
			return next(err);
		}
		next();
	};
};

// Middleware
const middlewareModel = (req, res, next) => {
	const modelname = req.params.modelname;
	req.modelname = modelname;
	req.Model = models[modelname];
	if (!req.Model) {
		const err = new errors.NotFoundError(`Model ${modelname} not found`);
		logRequestError(req, res, err, "model");
		return next(err);
	}
	return next();
};

const middlewarePasswords = (req, res, next) => {
	if (req.body && req.body.password) {
		if (req.query.password_override) {
			if (!res.user?.admin) {
				const err = new errors.ForbiddenError("password_override requires admin");
				logRequestError(req, res, err, "password_override");
				return next(err);
			}
		} else {
			req.body.password = security.encPassword(req.body.password);
		}
	}
	next();
};

const middlewareCheckAdmin = (req, res, next) => {
	if (req.modelname !== "user") return next();
	const isAdmin = res.user?.admin;
	if (!isAdmin) {
		if (req.params) req.params.admin = false;
		if (req.body) {
			for (const field of USER_PRIVILEGE_FIELDS) {
				if (field in req.body) {
					delete req.body[field];
				}
			}
		}
	}
	next();
};

// Outputs whatever is in res.result as JSON
const outputJSON = async (req, res) => {
	try {
		res.send(res.result);
	} catch (err) {
		logRequestError(req, res, err, "outputJSON");
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
}

// Outputs whatever is in res.result as CSV
const outputCSV = (req, res, next) => {
	const opts = { "flatten": true };
	if (!res.result.data) {
		throw new errors.InternalServerError("Error generating CSV");
	}
	try {
		const data = res.result.data.map(row => row._doc);
		if (!data.length) {
			throw ("")
		}
		res.writeHead(200, {
			'Content-Type': 'text/csv',
			'Content-Disposition': 'attachment; filename=export.csv'
		});
		const csv = new CsvParser(opts).parse(data);
		const limits = query_limits.getLimits(req);
		if (limits.max_response_bytes > 0) {
			const size = Buffer.byteLength(csv, "utf8");
			if (size > limits.max_response_bytes) {
				const err = new errors.PayloadTooLargeError(
					`CSV export size ${size} bytes exceeds maximum ${limits.max_response_bytes} bytes. ` +
						`Reduce ?limit= or narrow ?filter=.`
				);
				logRequestError(req, res, err, "response_size", `${size}B max=${limits.max_response_bytes}B`);
				throw err;
			}
		}
		res.end(csv);
		next();
	} catch (err) {
		if (!(err instanceof errors.PayloadTooLargeError)) {
			logRequestError(req, res, err, "outputCSV");
		}
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
}

// Actions (verbs)
const actionGet = async (req, res) => {
	const opname = `get ${req.modelname} ${ops++}`;
	console.time(opname);
	let filters = {};
	try {
		filters = parseFilter(req.query.filter);
		filters = query_sanitize.sanitizeFilter(filters, getSecurityOpts(req));
	} catch (err) {
		logRequestError(req, res, err, "filter");
		if (err instanceof errors.BadRequestError) {
			throw err;
		}
		if (err instanceof errors.ForbiddenError) {
			throw err;
		}
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
	const search = query_sanitize.parseSearchObject(req.query.search);
	for (const i in search) {
		filters[i] = search[i];
	}
	let countquery = filters;
	let qcount = req.Model.find(filters);
	let q = req.Model.find(filters);
	let checkDeleted = [{ _deleted: false }, { _deleted: null }];
	if (!req.query.showDeleted) {
		countquery = Object.assign({ $or: checkDeleted }, countquery);
		qcount.or(checkDeleted);
		q.or(checkDeleted);
	}
	if (req.query.search) {
		// console.log({ search: req.query.search });
		q = req.Model.find({ $text: { $search: req.query.search } }, { score: { $meta: "textScore" } }).sort({ score: { $meta: "textScore" } });
		countquery = Object.assign({ $text: { $search: req.query.search } }, countquery);
		qcount = req.Model.find({ $text: { $search: req.query.search } });
	}
	if (res.user) {
		q.options = ({ user: res.user });
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
			q.sort(req.query.sort);
			result.sort = req.query.sort;
		}
		if (req.query.populate) {
			if ((typeof req.query.populate === "object") && !Array.isArray(req.query.populate)) {
				for (let i in req.query.populate) {
					q.populate(i, req.query.populate[i].replace(/,/g, " "));
				}
			} else {
				q.populate(req.query.populate);
			}
			result.populate = req.query.populate;
		}
		if (req.query.autopopulate) {
			res.header("jxp-autopopulate-warning", "expensive");
			for (let key in req.Model.schema.paths) {
				const dirpath = req.Model.schema.paths[key];
				if (dirpath.instance == "ObjectID" && dirpath.options.link) {
					q.populate(String(dirpath.options.map_to || dirpath.options.virtual || dirpath.options.link.toLowerCase()));
				}
			}
			result.autopopulate = true;
		}
		if (req.query.fields) {
			const fields = req.query.fields.split(",");
			const select = {};
			fields.forEach(field => {
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
		if (debug) console.timeEnd(opname);
	} catch (err) {
		if (debug) console.timeEnd(opname);
		if (
			!(err instanceof errors.BadRequestError) &&
			!(err instanceof errors.ForbiddenError) &&
			!(err instanceof errors.PayloadTooLargeError)
		) {
			logRequestError(req, res, err, "get");
		}
		if (err instanceof errors.BadRequestError) {
			throw err;
		}
		if (err instanceof errors.ForbiddenError) {
			throw err;
		}
		if (err instanceof errors.PayloadTooLargeError) {
			throw err;
		}
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

const actionGetOne = async (req, res) => {
	const opname = `getOne ${req.modelname}/${req.params.item_id} ${ops++}`;
	console.time(opname);
	try {
		const data = await getOne(req.Model, req.params.item_id, req.query, { user: res.user });
		res.result = { data };
		if (debug) console.timeEnd(opname);
	} catch (err) {
		logRequestError(req, res, err, "getOne");
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

const actionPost = async (req, res) => {
	const opname = `post ${req.modelname} ${ops++}`;
	console.time(opname);
	try {
		let item = new req.Model();
		_populateItem(item, datamunging.deserialize(req.body));
		if (res.user) {
			item._owner_id = res.user._id;
			item.__user = res.user;
		}
		const result = await item.save();
		let silence = req.params._silence;
		if (req.body && req.body._silence) silence = true;
		if (!silence) {
			req.config.callbacks.post.call(null, req.modelname, result, res.user);
			ws.postHook.call(null, req.modelname, result, res.user);
		}
		res.json({
			status: "ok",
			message: req.modelname + " created",
			data: item
		});
		if (debug) console.timeEnd(opname);
	} catch (err) {
		logRequestError(req, res, err, "post");
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

const actionPut = async (req, res) => {
	const opname = `put ${req.modelname}/${req.params.item_id} ${ops++}`;
	console.time(opname);
	try {
		let item = await req.Model.findById(req.params.item_id);
		if (!item) {
			logAndThrow(
				req,
				res,
				new errors.NotFoundError(
					`Document ${req.params.item_id} not found on ${req.modelname}`
				),
				"put"
			);
		}
		_populateItem(item, datamunging.deserialize(req.body));
		_versionItem(item);
		if (res.user) {
			item.__user = res.user;
			item._updated_by_id = res.user._id;
		}
		const data = await item.save();
		let silence = req.params._silence;
		if (req.body && req.body._silence) silence = true;
		if (!silence) {
			req.config.callbacks.put.call(null, req.modelname, item, res.user);
			ws.putHook.call(null, req.modelname, item, res.user);
		}
		res.json({
			status: "ok",
			message: req.modelname + " updated",
			data: data
		});
		if (debug) console.timeEnd(opname);
	} catch (err) {
		logRequestError(req, res, err, "put");
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

const actionUpdate = async (req, res) => {
	const opname = `update ${req.modelname}/${req.params.item_id} ${ops++}`;
	console.time(opname);
	try {
		const body_data = datamunging.deserialize(req.body);
		const item = await req.Model.findById(req.params.item_id);
		if (!item) {
			throw new errors.NotFoundError(`Document ${req.params.item_id} not found on ${req.modelname}`);
		}
		_populateItem(item, body_data);
		_versionItem(item);
		if (res.user) {
			item.__user = res.user;
			item._updated_by_id = res.user._id;
		}
		const data = await item.save();
		let silence = req.params._silence;
		if (req.body && req.body._silence) silence = true;
		if (!silence) {
			req.config.callbacks.put.call(null, req.modelname, item, res.user);
			ws.putHook.call(null, req.modelname, item, res.user);
		}
		res.json({
			status: "ok",
			message: req.modelname + " updated",
			data
		});
		if (debug) console.timeEnd(opname);
	} catch (err) {
		logRequestError(req, res, err, "update");
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

const actionDelete = async (req, res) => {
	const permaDelete = req.query._permaDelete;
	const cascade = req.query._cascade;
	let silence = req.query._silence || (req.body && req.body._silence);
	const opname = `del ${req.modelname}/${req.params.item_id} ${ops++}`;
	console.time(opname);
	try {
		let item = await req.Model.findById(req.params.item_id);
		if (!item) {
			throw new errors.NotFoundError(`Couldn't find item ${req.params.item_id} for delete on ${req.modelname}`);
		}
		const linked_models = link_index.getReferrers(req.Model.modelName);
		const referrerChecks = linked_models.map(async (linked_model) => {
			const q: Record<string, unknown> = {};
			q[linked_model.field] = item._id;
			const check = await models[linked_model.modelname].countDocuments(q);
			if (check) {
				if (cascade) {
					if (permaDelete) {
						await models[linked_model.modelname].deleteMany(q);
					} else {
						await models[linked_model.modelname].updateMany(q, { _deleted: true });
					}
				} else {
					logAndThrow(
						req,
						res,
						new errors.ConflictError(
							`Parent link item exists in ${linked_model.modelname}/${linked_model.field}`
						),
						"delete"
					);
				}
			}
		});
		await Promise.all(referrerChecks);
		if (res.user) {
			item.__user = res.user;
		}
		if (Object.prototype.hasOwnProperty.call(req.Model.schema.paths, "_deleted") && !(permaDelete)) {
			item._deleted = true;
			_versionItem(item);
			await item.save();
		} else {
			// console.log("Hard deleting");
			await req.Model.deleteOne({ _id: item._id });
		}
		if (!silence) {
			req.config.callbacks.delete.call(
				null,
				req.modelname,
				item,
				res.user,
				{ soft: false }
			);
			ws.delHook.call(null, req.modelname, item, res.user);
		}
		res.json({
			status: "ok",
			message: `${req.modelname}/${req.params.item_id} deleted`
		});
		if (debug) console.timeEnd(opname);
	} catch (err) {
		if (!(err instanceof errors.ConflictError)) {
			logRequestError(req, res, err, "delete");
		}
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

const actionCount = async (req, res) => {
	const opname = `count ${req.modelname} ${ops++}`;
	console.time(opname);
	let filters = {};
	try {
		filters = parseFilter(req.query.filter);
		filters = query_sanitize.sanitizeFilter(filters, getSecurityOpts(req));
	} catch (err) {
		logRequestError(req, res, err, "filter");
		if (err instanceof errors.BadRequestError || err instanceof errors.ForbiddenError) {
			throw err;
		}
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
		if (debug) console.timeEnd(opname);
	} catch (err) {
		logRequestError(req, res, err, "count");
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

const actionCall = async (req, res) => {
	req.body = req.body || {};
	req.body.__user = res.user || null;
	try {
		call_guard.assertCallableStatic(req.Model, req.params.method_name);
		const result = await req.Model[req.params.method_name](req.body);
		res.json(result);
	} catch (err) {
		logRequestError(req, res, err, "call");
		if (err.code) throw err;
		if (err instanceof errors.ForbiddenError || err instanceof errors.NotFoundError) {
			throw err;
		}
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

const actionCallItem = async (req, res) => {
	try {
		call_guard.assertCallableStatic(req.Model, req.params.method_name);
		const item = await req.Model.findById(req.params.item_id);
		if (!item) {
			throw new errors.NotFoundError(`Couldn't find item ${req.params.item_id} on ${req.modelname} for call`);
		}
		if (item._deleted && !req.query.showDeleted) {
			throw new errors.NotFoundError(`Document ${req.params.item_id} is deleted on ${req.modelname}`);
		}
		const body = req.body || {};
		body.__user = res.user || null;
		const result = await req.Model[req.params.method_name](item, body);
		res.json(result);
	} catch (err) {
		logRequestError(req, res, err, "call");
		if (err.code) throw err;
		if (err instanceof errors.ForbiddenError || err instanceof errors.NotFoundError) {
			throw err;
		}
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

// Actions (verbs)
const actionQuery = async (req, res) => {
	if (!req.body || !req.body.query || typeof req.body.query !== "object") {
		logAndThrow(
			req,
			res,
			new errors.BadRequestError("Query missing or not of type object"),
			"query"
		);
	}
	const opname = `query ${req.modelname} ${ops++}`;
	console.time(opname);
	let sanitizedQuery;
	try {
		sanitizedQuery = query_sanitize.sanitizeFilter(req.body.query, getSecurityOpts(req));
	} catch (err) {
		logRequestError(req, res, err, "query_sanitize");
		if (err instanceof errors.BadRequestError || err instanceof errors.ForbiddenError) {
			throw err;
		}
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
	let query = [sanitizedQuery];
	let checkDeleted = { "$or": [{ _deleted: false }, { _deleted: null }] };
	if (!req.query.showDeleted) {
		query.push(checkDeleted);
	}
	let qcount = req.Model.find({ "$and": query });
	let q = req.Model.find({ "$and": query });
	try {
		const estimatedCount = await req.Model.estimatedDocumentCount();
		const result: Record<string, unknown> = {};
		const { limit: effectiveLimit, limitCapped, filterExemption } = query_limits.enforceListLimit(
			req,
			estimatedCount,
			res,
			{ result, bodyQuery: sanitizedQuery }
		);
		let count = -1;
		if (query_limits.shouldRunCount(req, { filterExemption, limitCapped })) {
			count = await qcount.countDocuments();
		}
		if (count >= 0) {
			result.count = count;
		}
		query_limits.applyListPagination(q, result, req, effectiveLimit, count >= 0 ? count : 0, changeUrlParams);
		if (req.query.sort) {
			q.sort(req.query.sort);
			result.sort = req.query.sort;
		}
		if (req.query.populate) {
			if ((typeof req.query.populate === "object") && !Array.isArray(req.query.populate)) {
				for (let i in req.query.populate) {
					q.populate(i, req.query.populate[i].replace(/,/g, " "));
				}
			} else {
				q.populate(req.query.populate);
			}
			result.populate = req.query.populate;
		}
		if (req.query.autopopulate) {
			for (let key in req.Model.schema.paths) {
				const dirpath = req.Model.schema.paths[key];
				if (dirpath.instance == "ObjectID" && dirpath.options.link) {
					q.populate(String(dirpath.options.map_to || dirpath.options.virtual || dirpath.options.link));
				}
			}
			result.autopopulate = true;
		}
		if (req.query.fields) {
			const fields = req.query.fields.split(",");
			const select = {};
			fields.forEach(field => {
				select[field] = 1;
			});
			q.select(select);
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
		if (debug) console.timeEnd(opname);
		res.json(result);
	} catch (err) {
		if (debug) console.timeEnd(opname);
		if (
			!(err instanceof errors.BadRequestError) &&
			!(err instanceof errors.ForbiddenError) &&
			!(err instanceof errors.PayloadTooLargeError)
		) {
			logRequestError(req, res, err, "query");
		}
		if (
			err instanceof errors.BadRequestError ||
			err instanceof errors.ForbiddenError ||
			err instanceof errors.PayloadTooLargeError
		) {
			throw err;
		}
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

// Actions (verbs)
const actionAggregate = async (req, res) => {
	let query = req.body?.query ? req.body.query : req.body;
	if (!query || !Array.isArray(query)) {
		logAndThrow(
			req,
			res,
			new errors.BadRequestError("Query missing or not of type array"),
			"aggregate"
		);
	}
	query = query_manipulation.fix_query(query);
	try {
		aggregate_guard.validatePipeline(query, {
			aggregate_stages_allow: getSecurityOpts(req).aggregate_stages_allow,
			isAdmin: res.user?.admin,
		});
	} catch (err) {
		logRequestError(req, res, err, "aggregate_guard");
		if (err instanceof errors.BadRequestError || err instanceof errors.ForbiddenError) {
			throw err;
		}
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
	const opname = `aggregate ${req.modelname} ${ops++}`;
	console.time(opname);
	try {
		let result: Record<string, unknown> = {};
		if (req.query.allowDiskUse) {
			result.data = await req.Model.aggregate(query).allowDiskUse(true).exec();
		} else {
			result.data = await req.Model.aggregate(query);
		}
		response_sanitize.sanitizeResponse(result, getStripFields(req));
		res.result = result;
		if (debug) console.timeEnd(opname);
		res.json(result);
	} catch (err) {
		if (debug) console.timeEnd(opname);
		if (
			!(err instanceof errors.BadRequestError) &&
			!(err instanceof errors.ForbiddenError)
		) {
			logRequestError(req, res, err, "aggregate");
		}
		if (err instanceof errors.BadRequestError || err instanceof errors.ForbiddenError) {
			throw err;
		}
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

// Actions (verbs)
const actionBulkWrite = async (req, res) => {
	if (!req.body || !Array.isArray(req.body)) {
		const err = new errors.BadRequestError("Query missing or not of type array");
		logRequestError(req, res, err, "bulkwrite");
		throw err;
	}
	const opname = `bulkwrite ${req.modelname} ${ops++}`;
	console.time(opname);
	const query = req.body;
	bulkwrite_guard.validateBulkOps(query, {
		bulk_operations_allow: getSecurityOpts(req).bulk_operations_allow,
		isAdmin: res.user?.admin,
	});
	try {
		let result: Record<string, unknown> = {};
		result.data = await req.Model.bulkWrite(query);
		res.result = result;
		if (debug) console.timeEnd(opname);
		res.json(result);
	} catch (err) {
		logRequestError(req, res, err, "bulkwrite");
		if (debug) console.timeEnd(opname);
		if (err instanceof errors.BadRequestError || err instanceof errors.ForbiddenError) {
			throw err;
		}
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

// var actionBatch = (req, res, next) => {
// 	console.time("BATCH " + req.modelname);
// 	var items = [];
// 	data = JSON.parse(req.params.json);
// 	data.forEach(function(data) {
// 		var item = new req.Model();
// 		if (res.user) {
// 			item.__user = res.user;
// 		}
// 		_populateItem(item, data);
// 		_versionItem(item);
// 		if (res.user) {
// 			item._owner_id = res.user._id;
// 		}
// 		items.push(item);
// 	});
// 	req.Model.create(items, function(err, docs) {
// 		if (err) {
// 			console.error(err);
// 			res.status(500).send(err.toString());
// 		} else {
// 			// websocket.emit(modelname, { method: "post", _id: result._id });
// 			console.log({ action_id: 8, action: "Batch insert", type: req.modelname, count: items.length, user: filterLogUser(res.user) });
// 			res.send({ message: req.modelname + " created ", data: items.length });
// 			if (debug) console.timeEnd("BATCH " + req.modelname);
// 			return;
// 		}
// 	});
// };



// Utitlities

const getOne = async (Model, item_id, params, options) => {
	const query = Model.findById(item_id, {}, options);
	if (params.populate) {
		if ((typeof params.populate === "object") && !Array.isArray(params.populate)) {
			for (let i in params.populate) {
				query.populate(i, params.populate[i].replace(/,/g, " "));
			}
		} else {
			query.populate(params.populate);
		}
	}
	if (params.autopopulate) {
		for (let key in Model.schema.paths) {
			var dirpath = Model.schema.paths[key];
			if (dirpath.instance == "ObjectID" && dirpath.options.link) {
				query.populate(String(dirpath.options.map_to || dirpath.options.virtual || dirpath.options.link.toLowerCase()));
			}
		}
	}
	try {
		var item = await query.exec();
		if (!item) {
			// console.error("Could not find document");
			throw new errors.NotFoundError(`Could not find document ${item_id} on ${Model.modelName}`);
		}
		if (item._deleted && !params.showDeleted) {
			// console.error("Document is deleted");
			throw new errors.NotFoundError(`Document ${item_id} is deleted on ${Model.modelName}`);
		}
		return response_sanitize.sanitizeDocument(item);
	} catch (err) {
		if (err.code) throw err;
		throw new errors.InternalServerError(safeErrorMessage(err));
	}
};

// Helper function to check if a string is an ISO date string
function isISODateString(str) {
	if (typeof str !== 'string') return false;
	const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
	if (!isoDateRegex.test(str)) return false;
	const date = new Date(str);
	if (isNaN(date.getTime())) {
		throw new errors.BadRequestError("Invalid date format");
	}
	return true;
}

const parseFilter = (filter, depth = 0) => {
	const MAX_DEPTH = 10;

	if (!filter) return {};
	if (depth > MAX_DEPTH) {
		throw new errors.BadRequestError("Maximum filter depth exceeded");
	}

	if (typeof filter !== "object" || filter === null) return filter;

	// Handle arrays by merging their operators
	if (Array.isArray(filter)) {
		const result = {};
		filter.forEach(item => {
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
						if (err instanceof errors.BadRequestError) {
							throw err;
						}
						throw new errors.BadRequestError("Invalid date format");
					}
				}
			}
		});
		return result;
	}

	// Create a new object to avoid modifying the input
	const parsedFilter = {};

	for (let i in filter) {
		if (filter[i] === "false") {
			parsedFilter[i] = false;
			continue;
		}
		if (filter[i] === "true") {
			parsedFilter[i] = true;
			continue;
		}
		if (typeof filter[i] === "string") {
			try {
				if (isISODateString(filter[i])) {
					parsedFilter[i] = new Date(filter[i]);
					continue;
				}
			} catch (err) {
				if (err instanceof errors.BadRequestError) {
					throw err;
				}
				throw new errors.BadRequestError("Invalid date format");
			}
			if (filter[i].includes(":")) {
				const parts = filter[i].split(":");
				const key = parts[0];
				const value = parts.slice(1).join(":");
				if (key.startsWith("$")) {
					try {
						if (isISODateString(value)) {
							if (!parsedFilter[i]) parsedFilter[i] = {};
							parsedFilter[i][key] = new Date(value);
						} else if (value.startsWith("[") && value.endsWith("]")) {
							if (!parsedFilter[i]) parsedFilter[i] = {};
							parsedFilter[i][key] = value.slice(1, -1).split(",");
						} else if (key === "$regex" && value.startsWith("/")) {
							if (!parsedFilter[i]) parsedFilter[i] = {};
							const match = value.match(/^\/(.+?)\/([gimy]*)$/);
							if (match) {
								parsedFilter[i][key] = new RegExp(match[1], match[2]);
							}
						} else {
							if (!parsedFilter[i]) parsedFilter[i] = {};
							parsedFilter[i][key] = value;
						}
					} catch (err) {
						if (err instanceof errors.BadRequestError) {
							throw err;
						}
						throw new errors.BadRequestError("Invalid date format");
					}
				} else {
					parsedFilter[i] = filter[i];
				}
			} else {
				parsedFilter[i] = filter[i];
			}
		} else if (Array.isArray(filter[i])) {
			parsedFilter[i] = parseFilter(filter[i], depth + 1);
		} else if (typeof filter[i] === "object") {
			parsedFilter[i] = parseFilter(filter[i], depth + 1);
		} else {
			parsedFilter[i] = filter[i];
		}
	}

	return parsedFilter;
};

const _deSerialize = (data) => {
	function assign(obj, keyPath, value) {
		const MAX_DEPTH = 20; // Prevent excessive nesting
		const lastKeyIndex = keyPath.length - 1;

		if (lastKeyIndex >= MAX_DEPTH) {
			console.warn('Maximum nesting depth exceeded in _deSerialize');
			return;
		}

		for (let i = 0; i < lastKeyIndex; ++i) {
			let key = keyPath[i];
			if (!(key in obj)) obj[key] = {};
			obj = obj[key];
		}
		obj[keyPath[lastKeyIndex]] = value;
	}

	if (!data || typeof data !== 'object') return;

	for (let datum in data) {
		const matches = datum.match(/\[(.+?)\]/g);
		if (matches) {
			const params = matches.map(function (match) {
				return match.replace(/[[\]]/g, "");
			});
			if (isNaN(Number(params[0]))) {
				params.unshift(datum.match(/(.+?)\[/)[1]);
				assign(data, params, data[datum]);
			}
		}
	}
};

const _populateItem = (item, data) => {
	_deSerialize(data);
	for (let prop in item) {
		if (typeof data[prop] != "undefined") {
			item[prop] = data[prop];
			// Unset any blank values - essentially 'deleting' values on editing
			if (data[prop] === "") {
				item[prop] = null;
			}
		}
		//Check for arrays that come in like param[1]=blah, param[2]=yack
		if (data[prop + "[0]"]) {
			var x = 0;
			var tmp = [];
			while (data[prop + "[" + x + "]"]) {
				tmp.push(data[prop + "[" + x + "]"]);
				x++;
			}
			item[prop] = tmp;
		}
	}
};

const _versionItem = (item) => {
	if (item._version || item._version === 0) {
		item._version++;
	} else {
		item._version = 0;
	}
};

const _fixArrays = (req, res, next) => {
	if (req.body) {
		for (var i in req.body) {
			if (i.search(/\[\d+\]/) > -1) {
				var parts = i.match(/(^[A-Za-z]+)(\[)/);
				var el = parts[1];
				if (!req.body[el]) {
					req.body[el] = [];
				}
				req.body[el].push(req.body[i]);
			}
		}
	}
	next();
};

const changeUrlParams = (req, key, val) => {
	var q = req.query;
	q[key] = val;
	return req.config.url + req.path() + "?" + querystring.stringify(q);
};

const JXP = function (options: JXPConfig) {
	// Must run before models load; reads QUERY_INDEX_MONITOR / INDEX_DIAGNOSTICS_ENABLED from env
	index_diagnostics.registerQueryIndexMonitor(options.index_diagnostics);

	const server = restify.createServer();
	const model_dir = options.model_dir || modeldir.findModelDir(path.dirname(process.argv[1]));
	//Set up config with default
	var config: JXPConfig & Record<string, unknown> = {
		model_dir: path.join(model_dir),
		mongo: options.mongo,
		callbacks: {
			put: function () { },
			post: function () { },
			delete: function () { },
			get: function () { },
			getOne: function () { },
			update: function () { },
		},
		log: "access.log",
		pre_hooks: {
			login: (req, res, next) => {
				next();
			},
			get: (req, res, next) => {
				next();
			},
			getOne: (req, res, next) => {
				next();
			},
			post: (req, res, next) => {
				next();
			},
			put: (req, res, next) => {
				next();
			},
			update: (req, res, next) => {
				next();
			},
			delete: (req, res, next) => {
				next();
			}
		},
		post_hooks: {
			login: async () => {
			},
		},
		cache_timeout: "5 minutes",
		query_limits: {
			enabled: true,
			large_collection_threshold: 10000,
			max: 1000,
			default: 100,
			require_limit_always: true,
			skip_count_unless_paginated: true,
			max_response_size: "10mb",
		},
		security: {
			strip_fields: ["password"],
		},
		cors: {
			origins: ["*"],
		},
	};
	//Override config with passed in options

	for (let i in options) {
		if (typeof config[i] === "object" && !Array.isArray(config[i])) {
			if (typeof options[i] === "object" && !Array.isArray(options[i])) {
				for (let j in options[i]) {
					config[i][j] = options[i][j]; // Second level object copy
				}
			}
		} else {
			config[i] = options[i];
		}
		if (i === "model_dir" || i === "log") {
			const value = String(options[i]);
			// Absolute paths unchanged; relative paths resolve from project cwd (npm scripts)
			config[i] = value.charAt(0) === "/" ? value : path.resolve(process.cwd(), value);
		}
	}

	if (config.debug) debug = true;

	// Set apikey and server globally to inject into schemas
	global.apikey = config.apikey;
	global.server = config.server;
	global.model_dir = config.model_dir as string;

	// Pre-load app models, then jxp built-ins for any missing slugs
	Object.assign(models, builtin_models.loadAllModels(config.model_dir as string));
	index_diagnostics.wireQueryLogPersistence(models);
	link_index.buildLinkIndex(models);

	setup.init(models, config);
	security.init(models, config);
	login.init(models, config);
	groups.init(models, config);
	ws.init({ models });
	cache.init(config);
	const docs = new Docs({ config, models });
	docsAuth.init(config);
	docsAuth.logDocsAccessMode(config);
	const loginThrottle = loginRateLimit.createLoginThrottle(config);
	loginRateLimit.logLoginRateLimit(config);

	// Set up our API server

	// Rate limitting
	if (config.throttle) {
		server.use(restify.plugins.throttle(config.throttle));
	}

	// Logging
	if (!config.quiet_startup) {
		console.log("Logging to", config.log);
	}

	var accessLogStream = fs.createWriteStream(config.log, { flags: "a" });
	server.use(morgan("combined", { stream: accessLogStream }));

	// CORS
	const corsOrigins = config.cors?.origins?.length ? config.cors.origins : ["*"];
	const cors = corsMiddleware({
		preflightMaxAge: 5, //Optional
		origins: corsOrigins,
		allowHeaders: ['X-Requested-With', 'Authorization'],
		exposeHeaders: ['Authorization']
	});

	server.pre(cors.preflight);
	server.use(cors.actual);

	// Parse data
	server.use(restify.plugins.queryParser());
	server.use(restify.plugins.bodyParser());

	// Bind our config to req.config
	server.use((req, res, next) => {
		req.config = config;
		next();
	});

	// Set req.username = "anonymous" if not logged in
	server.use((req, res, next) => {
		if (!req.username) req.username = "anonymous";
		next();
	});

	// Define our endpoints

	/* Our API endpoints */
	server.get(
		"/api/:modelname",
		middlewareModel,
		security.login,
		security.auth,
		config.pre_hooks.get,
		cache.get,
		actionGet,
		cache.set,
		outputJSON
	);
	server.get(
		"/api/:modelname/:item_id",
		middlewareModel,
		security.login,
		security.auth,
		config.pre_hooks.getOne,
		cache.get,
		actionGetOne,
		cache.set,
		outputJSON
	);
	server.post(
		"/api/:modelname",
		middlewareModel,
		security.login,
		security.auth,
		middlewarePasswords,
		config.pre_hooks.post,
		actionPost,
		cache.clearAll,
		(req, res, next) => {
			next();
		},
	);
	server.put(
		"/api/:modelname/:item_id",
		middlewareModel,
		security.login,
		security.auth,
		middlewarePasswords,
		middlewareCheckAdmin,
		config.pre_hooks.put,
		actionPut,
		cache.clearAll,
		(req, res, next) => {
			next();
		},
	);
	server.del(
		"/api/:modelname/:item_id",
		middlewareModel,
		security.login,
		security.auth,
		config.pre_hooks.delete,
		actionDelete,
		cache.clearAll,
	);

	// Count
	server.get(
		"/count/:modelname",
		middlewareModel,
		security.login,
		security.auth,
		config.pre_hooks.get,
		// cache.get,
		actionCount,
		// cache.set,
		outputJSON
	);

	// CSV endpoints
	server.get(
		"/csv/:modelname",
		middlewareModel,
		security.login,
		security.auth,
		config.pre_hooks.get,
		actionGet,
		outputCSV
	);

	// Query endpoints
	server.post(
		"/query/:modelname",
		middlewareModel,
		security.login,
		security.auth,
		middlewareAdvancedQueryAllowed("query"),
		config.pre_hooks.get,
		actionQuery,
	);

	server.post(
		"/aggregate/:modelname",
		middlewareModel,
		security.login,
		security.auth,
		middlewareAdvancedQueryAllowed("aggregate"),
		config.pre_hooks.get,
		actionAggregate
	);

	server.post(
		"/bulkwrite/:modelname",
		middlewareModel,
		security.login,
		middlewareBulkWriteAllowed,
		security.bulkAuth,
		config.pre_hooks.get,
		actionBulkWrite,
	);

	server.post(
		"/update/:modelname/:item_id",
		middlewareModel,
		security.login,
		security.auth,
		middlewarePasswords,
		middlewareCheckAdmin,
		config.pre_hooks.update,
		actionUpdate,
		cache.clearAll,
	);

	/* Batch routes - ROLLED BACK FOR NOW */
	// server.post('/batch/create/:modelname', middlewareModel, security.login, security.auth, actionBatch);

	/* Call Methods in our models */
	server.get(
		"/call/:modelname/:method_name",
		middlewareModel,
		security.login,
		security.auth,
		actionCall,
		cache.clearAll,
	);
	server.post(
		"/call/:modelname/:method_name",
		middlewareModel,
		security.login,
		security.auth,
		actionCall,
		cache.clearAll,
	);
	server.get(
		"/call/:modelname/:item_id/:method_name",
		middlewareModel,
		security.login,
		security.auth,
		actionCallItem,
		cache.clearAll,
	);

	/* Login and authentication */
	server.post("/login/recover", login.recover);
	server.post("/login/getjwt", security.login, login.getJWT);
	server.get("/login/logout", security.login, login.logout);
	server.get("/logout", security.login, login.logout);
	server.get("/login/oauth/:provider", login.oauth);
	server.get("/login/oauth/callback/:provider", login.oauth_callback);
	const loginChain = [
		...(loginThrottle ? [loginThrottle] : []),
		config.pre_hooks.login,
		login.login,
		config.post_hooks.login,
		outputJSON,
	];
	server.post("/login", ...loginChain);
	server.post("/refresh", security.refresh);
	server.post("/login/refresh", security.refresh);

	/* Groups */
	server.put(
		"/groups/:user_id",
		security.login,
		security.admin_only,
		_fixArrays,
		groups.actionPut,
	);
	server.post(
		"/groups/:user_id",
		security.login,
		security.admin_only,
		_fixArrays,
		groups.actionPost,
	);
	server.get("/groups/:user_id", security.login, groups.actionGet);
	server.del("/groups/:user_id", security.login, security.admin_only, groups.actionDelete);

	/* Meta */
	server.get("/model/:modelname", middlewareModel, docs.metaModel.bind(docs));
	server.get("/model", docs.metaModels.bind(docs));
	// server.get("/docs/_design", docs.dbDiagram.bind(docs));
	server.get("/docs/login", async (req, res) => {
		await docsAuth.loginPage(req, res, docs.renderLogin.bind(docs));
	});
	server.post(
		"/docs/session",
		...(loginThrottle ? [loginThrottle] : []),
		docsAuth.establishSession,
	);
	server.get("/docs/session", docsAuth.getSession);
	server.post("/docs/logout", docsAuth.logout);
	server.get("/docs/assets/:file", docs.serveAsset.bind(docs));
	server.get("/docs/api", docsAuth.docsAccessMiddleware, docs.apiIndex.bind(docs));
	server.get("/docs/diagnostics", docsAuth.docsAccessMiddleware, docs.diagnostics.bind(docs));
	server.get("/docs/md/:md_doc", docs.md.bind(docs));
	server.get("/docs/model/:modelname", docsAuth.docsAccessMiddleware, docs.model.bind(docs));
	server.get("/", docs.frontPage.bind(docs));

	/* Setup */
	server.get("/setup", setup.checkUserDoesNotExist, setup.setup);
	server.post("/setup", setup.checkUserDoesNotExist, setup.setup);
	server.post("/setup/data", setup.checkUserDoesNotExist, setup.data_setup);

	/* Websocket */
	server.on("upgrade", ws.upgrade);

	server.on("restError", (req, res, err, callback) => {
		logRequestError(req, res, err);
		return callback();
	});

	/* Cache */
	server.get("/cache/stats", security.login, security.admin_only, cache.stats, outputJSON);
	server.get("/cache/clear", security.login, security.admin_only, cache.clearAll, outputJSON);

	/* Index diagnostics (admin) */
	const actionDiagnosticsIndexes = async (req, res) => {
		const refresh = req.query?.refresh === "true" || req.query?.refresh === "1";
		const includeUnused = req.query?.unused === "true" || req.query?.unused === "1";
		res.result = await index_diagnostics.getCachedIndexAudit(models, {
			refresh: !!refresh,
			includeUnused: !!includeUnused,
		});
	};

	const actionDiagnosticsQueries = async (req, res) => {
		const limit = parseInt(String(req.query?.limit ?? "50"), 10);
		const skip = parseInt(String(req.query?.skip ?? "0"), 10);
		const severity =
			typeof req.query?.severity === "string" ? req.query.severity : undefined;
		const modelRaw =
			typeof req.query?.model === "string"
				? req.query.model
				: typeof req.query?.model_name === "string"
					? req.query.model_name
					: undefined;
		const model_name = modelRaw
			? builtin_models.resolveModelFilterName(models, modelRaw)
			: undefined;
		res.result = await index_diagnostics.listQueryLogs({
			limit: Number.isFinite(limit) ? limit : 50,
			skip: Number.isFinite(skip) ? skip : 0,
			severity,
			model_name,
		});
	};

	const actionDiagnosticsIndexesSync = async (req, res) => {
		const confirm =
			typeof req.body?.confirm === "string"
				? req.body.confirm
				: typeof req.query?.confirm === "string"
					? req.query.confirm
					: undefined;
		const who = res.user?.email || res.user?._id?.toString?.() || "unknown";
		console.log(
			`[index-diagnostics] sync requested by ${who} confirm=${confirm === index_diagnostics.SYNC_CONFIRM_PHRASE ? "ok" : "invalid"}`
		);
		try {
			res.result = await index_diagnostics.syncAllModels(models, { confirm });
		} catch (err) {
			logRequestError(req, res, err, "diagnostics/indexes/sync");
			throw err;
		}
	};

	server.get(
		"/diagnostics/indexes",
		security.login,
		security.admin_only,
		actionDiagnosticsIndexes,
		outputJSON
	);
	server.get(
		"/diagnostics/queries",
		security.login,
		security.admin_only,
		actionDiagnosticsQueries,
		outputJSON
	);
	server.post(
		"/diagnostics/indexes/sync",
		security.login,
		security.admin_only,
		actionDiagnosticsIndexesSync,
		outputJSON
	);

	return server;
};

export = JXP;
