const errors = require("restify-errors");
const restify = require("restify");
const path = require("path");
const security = require("./security");
const datamunging = require("./datamunging");
const login = require("./login");
const groups = require("./groups");
const setup = require("./setup");
const Docs = require("./docs");
const querystring = require("querystring");
const fs = require("fs");
const morgan = require("morgan");
const ws = require("./ws");
const modeldir = require("./modeldir");
const query_manipulation = require("./query_manipulation");
const corsMiddleware = require('restify-cors-middleware2');
const json2csv = require('json2csv').parse;
const cache = require("./cache");
global.JXPSchema = require("./schema");

var models = {};

var ops = 0;

var debug = false;

// Middleware
const middlewareModel = (req, res, next) => {
	const modelname = req.params.modelname;
	req.modelname = modelname;
	// console.log("Model", modelname);
	try {
		req.Model = models[modelname];
		return next();
	} catch (err) {
		console.error(new Date, err);
		throw new errors.NotFoundError(`Model ${modelname} not found`);
	}
};

const middlewarePasswords = (req, res, next) => {
	if (req.body && req.body.password && !req.query.password_override) {
		req.body.password = security.encPassword(req.body.password);
	}
	next();
};

const middlewareCheckAdmin = (req, res, next) => {
	//We don't want users to pump up their own permissions
	if (req.modelname !== "user") return next();
	if (res.user.admin) return next();
	req.params.admin = false;
	next();
};

// Outputs whatever is in res.result as JSON
const outputJSON = (req, res, next) => {
	try {
		res.send(res.result);
		next();
	} catch (err) {
		console.error(new Date(), err);
		throw new errors.InternalServerError(err.toString());
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
			throw("")
		}
		res.writeHead(200, {
			'Content-Type': 'text/csv',
			'Content-Disposition': 'attachment; filename=export.csv'
		});
		const csv = json2csv(data, opts);
		res.end(csv);
		next();
	} catch (err) {
		console.error(err);
		throw new errors.InternalServerError(err.toString());
	}
}

// Actions (verbs)
const actionGet = async (req, res) => {
	const opname = `get ${req.modelname} ${ops++}`;
	console.time(opname);
	const parseSearch = function(search) {
		let result = {};
		for (let i in search) {
			result[i] = new RegExp(search[i], "i");
		}
		return result;
	};
	let filters = {};
	try {
		filters = parseFilter(req.query.filter);
	} catch (err) {
		console.trace(new Date(), err);
		throw new errors.InternalServerError(err.toString());
	}
	let search = parseSearch(req.query.search);
	for (let i in search) {
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
		q = req.Model.find({ $text: { $search: req.query.search }}, { score : { $meta: "textScore" } }).sort( { score: { $meta : "textScore" } } );
		countquery = Object.assign({ $text: { $search: req.query.search }}, countquery);
		qcount = req.Model.find({ $text: { $search: req.query.search }});
	}
	if (res.user) {
		q.options = ({ user: res.user });
	}
	try {
		let count = await req.Model.estimatedDocumentCount();
		if (count < 100000 && Object.keys(countquery).length !== 0) {
			count = await qcount.countDocuments();
		} else {
			count = -1;
		}
		const result = { count };
		const limit = parseInt(req.query.limit);
		if (limit) {
			q.limit(limit);
			result.limit = limit;
			let page_count = Math.ceil(count / limit);
			result.page_count = page_count;
			let page = parseInt(req.query.page);
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
		res.result = result;
		if (debug) console.timeEnd(opname);
	} catch(err) {
		console.error(new Date(), err);
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
	}
};

const actionGetOne = async (req, res) => {
	const opname = `getOne ${req.modelname}/${req.params.item_id} ${ops++}`;
	console.time(opname);
	try {
		const data = await getOne(req.Model, req.params.item_id, req.query, { user: res.user });
		res.result = { data };
		if (debug) console.timeEnd(opname);
	} catch(err) {
		console.error(new Date(), err);
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
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
		console.error(new Date(), err);
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
	}
};

const actionPut = async (req, res) => {
	const opname = `put ${req.modelname}/${req.params.item_id} ${ops++}`;
	console.time(opname);
	try {
		let item = await req.Model.findById(req.params.item_id);
		if (!item) {
			console.error(new Date(), "Document not found");
			throw new errors.NotFoundError(`Document ${req.params.item_id} not found on ${req.modelname}`);
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
			req.config.callbacks.put.call(null, req.modelname, item, res.user );
			ws.putHook.call(null, req.modelname, item, res.user);
		}
		res.json({
			status: "ok",
			message: req.modelname + " updated",
			data: data
		});
		if (debug) console.timeEnd(opname);
	} catch (err) {
		console.error(new Date(), err);
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
	}
};

const actionUpdate = async (req, res) => {
	const opname = `update ${req.modelname}/${req.params.item_id} ${ops++}`;
	console.time(opname);
	try {
		let body_data =  datamunging.deserialize(req.body);
		const data = await req.Model.update({ _id: req.params.item_id }, body_data);
		let silence = req.params._silence;
		if (req.body && req.body._silence) silence = true;
		if (!silence) {
			req.config.callbacks.put.call(null, req.modelname, data, res.user );
			ws.putHook.call(null, req.modelname, data, res.user);
		}
		res.json({
			status: "ok",
			message: req.modelname + " updated",
			data
		});
		if (debug) console.timeEnd(opname);
	} catch (err) {
		console.error(new Date(), err);
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
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
		// Get linked models
		const linked_models = [];
		const link_modelnames = Object.getOwnPropertyNames(models);
		for (let link_modelname of link_modelnames) {
			const link_definitions = Object.getOwnPropertyNames(models[link_modelname].schema.definition);
			for (let link_definition of link_definitions) {
				if (req.Model.modelName === models[link_modelname].schema.definition[link_definition].link) {
					linked_models.push({
						modelname: link_modelname,
						field: link_definition
					});
				}
			}
		}
		// Test that none of our linked models have this ID we're trying to delete
		for (let linked_model of linked_models) {
			const q = {};
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
					throw new errors.ConflictError(`Parent link item exists in ${linked_model.modelname}/${linked_model.field}`);
				}
			}
		}
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
			message: `${req.modelname}/${ req.params.item_id } deleted`
		});
		if (debug) console.timeEnd(opname);
	} catch(err) {
		console.error(new Date(), err);
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
	}
};

const actionCount = async (req, res) => {
	const opname = `count ${req.modelname} ${ops++}`;
	console.time(opname);
	const parseSearch = function(search) {
		let result = {};
		for (let i in search) {
			result[i] = new RegExp(search[i], "i");
		}
		return result;
	};
	let filters = {};
	try {
		filters = parseFilter(req.query.filter);
	} catch (err) {
		console.trace(new Date(), err);
		throw new errors.InternalServerError(err.toString());
	}
	let search = parseSearch(req.query.search);
	for (let i in search) {
		filters[i] = search[i];
	}
	if (!req.query.showDeleted) {
		filters = Object.assign({ $or: [{ _deleted: false }, { _deleted: null }] }, filters);
	}
	try {
		const count = await req.Model.countDocuments(filters).exec();
		res.result = { count };
		if (debug) console.timeEnd(opname);
	} catch(err) {
		console.error(new Date(), err);
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
	}
};

const actionCall = async (req, res) => {
	// console.log({ action_id: 7, action: "Method called", type: req.modelname, method: req.params.method_name, user: filterLogUser(res.user) });
	req.body = req.body || {};
	req.body.__user = res.user || null;
	try {
		const result = await req.Model[req.params.method_name](req.body);
		res.json(result);
	} catch(err) {
		console.error(new Date(), err);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
	}
};

const actionCallItem = async (req, res) => {
	try {
		const item = req.Model.findById(req.params.item_id);
		if (!item) {
			throw new errors.NotFoundError(`Couldn't find item ${req.params.item_id} on ${req.modelname} for call`);
		}
		req.params.__user = res.user || null;
		const result = await req.Model[req.params.method_name](item);
		res.json(result);
	} catch(err) {
		console.trace(err);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
	}
};

// Actions (verbs)
const actionQuery = async (req, res) => {
	if (!req.body || !req.body.query || typeof req.body.query !== "object") {
		throw new errors.BadRequestError("Query missing or not of type object");
	}
	const opname = `query ${req.modelname} ${ops++}`;
	console.time(opname);
	let query = [req.body.query];
	let checkDeleted = { "$or": [{ _deleted: false }, { _deleted: null }] };
	if (!req.query.showDeleted) {
		query.push(checkDeleted);
	}
	let qcount = req.Model.find({ "$and": query });
	let q = req.Model.find({ "$and": query });
	try {
		const count = await qcount.countDocuments();
		const result = { count };
		const limit = parseInt(req.query.limit);
		if (limit) {
			q.limit(limit);
			result.limit = limit;
			let page_count = Math.ceil(count / limit);
			result.page_count = page_count;
			let page = parseInt(req.query.page);
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
		res.result = result;
		if (debug) console.timeEnd(opname);
		res.json(result);
	} catch(err) {
		console.error(new Date(), err);
		if (debug) console.timeEnd(opname);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
	}
};

// Actions (verbs)
const actionAggregate = async (req, res) => {
	let query = (req.body.query) ? req.body.query : req.body; // Don't require to embed in query anymore
	if (!query || !Array.isArray(query)) {
		console.error("query missing or not of type array")
		throw new errors.BadRequestError("Query missing or not of type array");
	}
	query = query_manipulation.fix_query(query);
	const opname = `aggregate ${req.modelname} ${ops++}`;
	console.time(opname);
	try {
		let result = {};
		if (req.query.allowDiskUse) {
			result.data = await req.Model.aggregate(query).allowDiskUse(true).exec();
		} else {
			result.data = await req.Model.aggregate(query);
		}
		res.result = result;
		if (debug) console.timeEnd(opname);
		res.json(result);
	} catch (err) {
		console.error(new Date(), err);
		if (debug) console.timeEnd(opname);
		throw new errors.InternalServerError(err.toString());
	}
};

// Actions (verbs)
const actionBulkWrite = async (req, res) => {
	if (!req.body || !Array.isArray(req.body)) {
		console.error("query missing or not of type array")
		throw new errors.BadRequestError("Query missing or not of type array");
	}
	const opname = `bulkwrite ${req.modelname} ${ops++}`;
	console.time(opname);
	let query = req.body;
	// console.log(query);
	try {
		let result = {};
		result.data = await req.Model.bulkWrite(query);
		res.result = result;
		if (debug) console.timeEnd(opname);
		res.json(result);
	} catch (err) {
		console.error(new Date(), err);
		if (debug) console.timeEnd(opname);
		throw new errors.InternalServerError(err.toString());
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
		if ((typeof params.populate === "object")  && !Array.isArray(params.populate)) {
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
		item = item.toObject();
		//Don't ever return passwords
		delete item.password;
		return item;
	} catch(err) {
		console.error(err);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
	}
};

const parseFilter = (filter) => {
	if (!filter)
		return {};
	if (typeof filter == "object") {
		Object.keys(filter).forEach(function(key) {
			var val = filter[key];
			if (filter[key] === "false") filter[key] = false;
			if (filter[key] === "true") filter[key] = true;
			if (val.indexOf) {
				if (val.indexOf(":") !== -1) {
					let tmp = val.split(":");
					filter[key] = {};
					let tmpkey = tmp.shift();
					let tmpval = tmp.join(":");
					if ((tmpval[0] === "[") && (tmpval[tmpval.length - 1] === "]")) { // Could be an array for a $in or similar
						let arr = tmpval.slice(1, tmpval.length - 1).split(",");
						tmpval = arr;
					}
					filter[key][tmpkey] = tmpval;
					if (tmpkey === "$regex" && tmpval[0] === "/") {
						let match = tmpval.match(new RegExp('^/(.*?)/([gimy]*)$'));
						let regex = new RegExp(match[1], match[2]);
						filter[key][tmpkey] = regex;
					}
				}
				if (typeof val == "object") {
					let result = parseFilter(val);
					filter[key] = {};
					for (let x = 0; x < result.length; x++) {
						filter[key][Object.keys(result[x])[0]] =
							result[x][Object.keys(result[x])[0]];
					}
				}
			}
		});
	}
	return filter;
}

const _deSerialize = (data) => {
	function assign(obj, keyPath, value) {
		// http://stackoverflow.com/questions/5484673/javascript-how-to-dynamically-create-nested-objects-using-object-names-given-by
		const lastKeyIndex = keyPath.length - 1;
		for (let i = 0; i < lastKeyIndex; ++i) {
			let key = keyPath[i];
			if (!(key in obj)) obj[key] = {};
			obj = obj[key];
		}
		obj[keyPath[lastKeyIndex]] = value;
	}
	for (let datum in data) {
		const matches = datum.match(/\[(.+?)\]/g);
		if (matches) {
			const params = matches.map(function(match) {
				return match.replace(/[[\]]/g, "");
			});
			if (isNaN(params[0])) {
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

const JXP = function(options) {
	const server = restify.createServer();
	const model_dir = options.model_dir || modeldir.findModelDir(path.dirname(process.argv[1]));
	//Set up config with default
	var config = {
		model_dir: path.join(model_dir),
		mongo: options.mongo,
		callbacks: {
			put: function() {},
			post: function() {},
			delete: function() {},
			get: function() {},
			getOne: function() {},
			update: function() {},
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
			// Decide whether it's absolute or relative
			if (config.model_dir.charAt(0) === "/") {
				config[i] = options[i];
			} else {
				config[i] = path.join(
					path.dirname(process.argv[1]),
					options[i]
				);
			}
		}
	}

	if (config.debug) debug = true;

	// Set apikey and server globally to inject into schemas
	global.apikey = config.apikey;
	global.server = config.server;
	global.model_dir = model_dir;
	
	// Pre-load models
	var files = fs.readdirSync(config.model_dir);
	let modelnames = files.filter(function(fname) {
		return fname.indexOf("_model.js") !== -1;
	});
	modelnames.forEach(function(fname) {
		var modelname = fname.replace("_model.js", "");
		models[modelname] = require(path.join(config.model_dir, fname));
	});

	setup.init(config);
	security.init(config);
	login.init(config);
	groups.init(config);
	ws.init({models});
	const docs = new Docs({config, models});

	// Set up our API server

	// Rate limitting
	if (config.throttle) {
		server.use(restify.plugins.throttle(config.throttle));
	}

	// Logging
	console.log("Logging to", config.log);

	var accessLogStream = fs.createWriteStream(config.log, { flags: "a" });
	server.use(morgan("combined", { stream: accessLogStream }));

	// CORS
	const cors = corsMiddleware({
		preflightMaxAge: 5, //Optional
		origins: ['*'],
		allowHeaders: ['X-Requested-With','Authorization'],
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
		cache.get,
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
		cache.clear,
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
		cache.clear,
	);
	server.del(
		"/api/:modelname/:item_id",
		middlewareModel,
		security.login,
		security.auth,
		config.pre_hooks.delete,
		actionDelete,
		cache.clear,
	);

	// Count
	server.get(
		"/count/:modelname",
		middlewareModel,
		security.login,
		security.auth,
		config.pre_hooks.get,
		cache.get,
		actionCount,
		cache.set,
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
		config.pre_hooks.get,
		actionQuery,
	);

	server.post(
		"/aggregate/:modelname",
		middlewareModel,
		security.login,
		security.auth,
		config.pre_hooks.get,
		actionAggregate
	);

	server.post(
		"/bulkwrite/:modelname",
		middlewareModel,
		security.login,
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
		cache.clear,
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
		cache.clear,
	);
	server.post(
		"/call/:modelname/:method_name",
		middlewareModel,
		security.login,
		security.auth,
		actionCall,
		cache.clear,
	);
	server.get(
		"/call/:modelname/:item_id/:method_name",
		middlewareModel,
		security.login,
		security.auth,
		actionCallItem,
		cache.clear,
	);

	/* Login and authentication */
	server.post("/login/recover", login.recover);
	server.post("/login/getjwt", security.login, login.getJWT);
	server.get("/login/logout", security.login, login.logout);
	server.get("/logout", security.login, login.logout);
	server.get("/login/oauth/:provider", login.oauth);
	server.get("/login/oauth/callback/:provider", login.oauth_callback);
	server.post("/login", config.pre_hooks.login, login.login, config.post_hooks.login, outputJSON);
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
	server.get("/docs/md/:md_doc", docs.md.bind(docs));
	server.get("/docs/model/:modelname", docs.model.bind(docs));
	server.get("/", docs.frontPage.bind(docs));

	/* Setup */
	server.get("/setup", setup.checkUserDoesNotExist, setup.setup);
	server.post("/setup", setup.checkUserDoesNotExist, setup.setup);
	server.post("/setup/data", setup.checkUserDoesNotExist, setup.data_setup);

	/* Websocket */
	server.on("upgrade", ws.upgrade)

	/* Cache */
	server.get("/cache/stats", cache.stats, outputJSON);
	server.get("/cache/clear", cache.clear, outputJSON);

	return server;
};

module.exports = JXP;
