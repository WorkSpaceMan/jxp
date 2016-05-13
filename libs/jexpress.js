var restify = require("restify");
var mongoose = require("mongoose");
var Q = require("q");
var security = require("../libs/security");
var datamunging = require("../libs/datamunging");
var login = require("../libs/login");
var groups = require("../libs/groups");
var querystring = require('querystring');

// Middleware
var middlewareModel = function(req, res, next) {
	var modelname = req.params.modelname;
	req.modelname = modelname;
	console.log("Model", modelname);
	try {
		req.Model = require('../models/' + modelname + "_model");
		return next();
	} catch(err) {
		console.error(err);
		return res.send(404, "Model " + modelname + " not found");
	}
};

var middlewarePasswords = function(req, res, next) {
	if (req.params.password && !(req.query.password_override)) {
		req.params.password = security.encPassword(req.params.password);
		console.log("Password encrypted");
	}
	next();
};

// Actions (verbs)
var actionGet = function(req, res) {
	console.time("GET " + req.modelname);
	
	var parseSearch = function(search) {
		var result = {};
		for(var i in search) {
			result[i] = new RegExp(search[i], "i");
		}
		return result;
	};

	var filters = {};
	try {
		filters = parseFilter(req.query.filter);
	} catch(err) {
		console.error(err);
		res.send(500, err.toString());
		return;
	}
	var search = parseSearch(req.query.search);
	for (var i in search) {
		filters[i] = search[i];
	}
	var qcount = req.Model.find(filters);
	var q = req.Model.find(filters);
	var checkDeleted = [ { _deleted: false }, { _deleted: null }];
	if (!req.query.showDeleted) {
		qcount.or(checkDeleted);
		q.or(checkDeleted);
	}
	qcount.count({}, function(err, count) {
		if (err) {
			console.error(err);
			res.send(500, err);
			return;
		}
		var result = {};
		result.count = count;
		var limit = parseInt(req.query.limit);
		if (limit) {
			q.limit(limit);
			result.limit = limit;
			var page_count = Math.ceil(count / limit);
			result.page_count = page_count;
			var page = parseInt(req.query.page);
			page = (page) ? page : 1;
			result.page = page;
			if (page < page_count) {
				result.next = changeUrlParams(req, "page", (page + 1));
			}
			if (page > 1) {
				result.prev = changeUrlParams(req, "page", (page - 1));
				q.skip(limit * (page - 1));
			}
		}
		if (req.query.sort) {
			q.sort(req.query.sort);
			result.sort = req.query.sort;
		}
		if (req.query.populate) {
			try {
				q.populate(req.query.populate);
				result.populate = req.query.populate;
			} catch(error) {
				console.error(error);
				res.send(500, error.toString());
				return;
			}
		}
		if (req.query.autopopulate) {
			for(var key in req.Model.schema.paths) {
				var path = req.Model.schema.paths[key];
				if ((path.instance == "ObjectID") && (path.options.ref)) {
					q.populate(path.path);
				}
			}
			result.autopopulate = true;
		}
		try {
			q.exec(function(err, items) {
				if (err) {
					console.error(err);
					res.send(500, err);
				} else {
					console.log({ action_id: 3, action: "Fetched documents", type: req.modelname, count: result.count, autopopulate: result.autopopulate, limit: result.limit, page: result.page, filters: filters, user: req.user });
					result.data = items;
					res.send(result);
					console.timeEnd("GET " + req.modelname);
				}
			});
		} catch(error) {
			console.error(error);
			res.send(500, error);
			return;
		}
	});
};

var actionGetOne = function(req, res) {
	console.time("GET " + req.modelname + "/" + req.params.item_id);
	getOne(req.Model, req.params.item_id, req.query)
	.then(function(item) {
		res.send(item);
		console.timeEnd("GET " + req.modelname + "/" + req.params.item_id);
	}, function(err) {
		console.error(err);
		if (err.code) {
			res.send(500,err.msg);
		} else {
			res.send(500, err.toString());
		}
	});
};

var actionPost = function(req, res, next) {
	console.time("POST " + req.modelname);
	try {
		var item = new req.Model();
		_populateItem(item, datamunging.deserialize(req.params));
		if (req.user) {
			item._owner_id = req.user._id;
			item.__user = req.user;
		}
		item.save(function(err, result) {
			if (err) {
				console.error(err);
				res.send(500, err.toString());
				return;
			} else {
				console.log({ action_id: 4, action: "Post", type: req.modelname, id: result._id, user: req.user });
				req.config.callbacks.post.call(null, req.modelname, result, req.user);
				res.json({ status: "ok", message: req.modelname + " created", data: item });
				console.timeEnd("POST " + req.modelname);
				return;
			}
		});
	} catch(err) {
		console.error(err);
		res.send(500, err.toString());
		return;
	}
};

var actionPut = function(req, res) {
	console.time("PUT " + req.modelname + "/" + req.params.item_id);
	try {
		req.Model.findById(req.params.item_id, function(err, item) {
			if (err) {
				res.send(500, err.toString());
			} else {
				if (item) {
					_populateItem(item, datamunging.deserialize(req.body));
					_versionItem(item);
					try {
						if (req.user) {
							item.__user = req.user;
						}
						item.save(function(err, data) {
							if (err) {
								console.error(err);
								res.send(500, err.toString());
							} else {
								console.log({ action_id: 5, action: "Put", type: req.modelname, id: item._id, user: req.user });
								req.config.callbacks.put.call(null, req.modelname, item, req.user);
								res.json({ status: "ok", message: req.modelname + " updated", data: data });
								console.timeEnd("PUT " + req.modelname + "/" + req.params.item_id);
							}
						});
					} catch(error) {
						console.error(error);
						res.send(500, error.toString());
						return;
					}
				} else {
					console.error("Document not found");
					res.send(404, "Document not found");
					return;
				}
			}
		});
	} catch(err) {
		console.error(err);
		res.send(500, err.toString());
		return;
	}
};

var actionDelete = function(req, res) {
	req.Model.findById(req.params.item_id, function(err, item) {
		if (!item) {
			console.error("Couldn't find item for delete");
			res.send(404, "Could not find document");
			return;
		}
		if (err) {
			console.error(err);
			res.send(500, err.toString());
			return;
		}
		if (req.user) {
			item.__user = req.user;
		}
		if (req.Model.schema.paths.hasOwnProperty("_deleted")) {
			console.log("Soft deleting");
			item._deleted = true;
			_versionItem(item);
			item.save(function(err) {
				if (err) {
					console.error(err);
					res.send(500, err.toString());
				} else {
					console.log({ action_id: 6, action: "Delete", type: req.modelname, softDelete: true, id: item._id, user: req.user });
					req.config.callbacks.delete.call(null, req.modelname, item, req.user, { soft: true });
					res.json({ status: "ok", message: req.modelname + ' deleted' });
				}
			});
		} else {
			console.log("Hard deleting");
			item.remove(function(err) {
				if (err) {
					console.error(err);
					res.send(500, err.toString());
				} else {
					console.log({ action_id: 6, action: "Delete", type: req.modelname, softDelete: false, id: item._id, user: req.user });
					req.config.callbacks.delete.call(null, req.modelname, item, req.user, { soft: false });
					res.json({ status: "ok", message: req.modelname + ' deleted' });
				}
			});
		}
	});
};

var actionCall = function(req, res) {
	console.log({ action_id: 7, action: "Method called", type: req.modelname, method: req.params.method_name, user: req.user });
	req.Model[req.params.method_name](req.params)
	.then(function(result) {
		res.json(result);
	}, function(err) {
		console.error(err);
		res.send(500, err);
	});
};

var actionCallItem = function(req, res) {
	req.Model.findById(req.params.item_id, function(err, item) {
		if (!item) {
			res.send(404, "Document not found for " + req.params.method_name);
			return;
		}
		if (err) {
			console.error(err);
			res.send(500, err);
			return;
		}
		req.Model[req.params.method_name](item)
		.then(function(item) {
			console.log({ action_id: 7, action: "Method called", type: req.modelname, id: item._id, method: req.params.method_name, user: req.user });
			res.json(item);
		}, function(err) {
			console.error(err);
			res.send(500, err);
		});
	});
};

// var actionBatch = function(req, res, next) {
// 	console.time("BATCH " + req.modelname);
// 	var items = [];
// 	data = JSON.parse(req.params.json);
// 	data.forEach(function(data) {
// 		var item = new req.Model();
// 		if (req.user) {
// 			item.__user = req.user;
// 		}
// 		_populateItem(item, data);
// 		_versionItem(item);
// 		if (req.user) {
// 			item._owner_id = req.user._id;
// 		}
// 		items.push(item);
// 	});
// 	req.Model.create(items, function(err, docs) {
// 		if (err) {
// 			console.error(err);
// 			res.status(500).send(err.toString());
// 		} else {
// 			// websocket.emit(modelname, { method: "post", _id: result._id });
// 			console.log({ action_id: 8, action: "Batch insert", type: req.modelname, count: items.length, user: req.user });
// 			res.send({ message: req.modelname + " created ", data: items.length });
// 			console.timeEnd("BATCH " + req.modelname);
// 			return;
// 		}
// 	});
// };

// Meta

var metaModels = function(req, res, next) {
	var fs = require("fs");
	var path = require("path");
	model_dir = path.join(process.argv[1], "/../../models");
	fs.readdir(model_dir, function(err, files) {
		if (err) {
			console.error(err);
			res.send(500, "Error reading models directory " + model_dir);
			return false;
		}
		var models = [];
		files.forEach(function(file) {
			var modelname = path.basename(file, ".js").replace("_model", "");
			try {
				var modelobj = require("../models/" + file);
				if (modelobj.schema && modelobj.schema.get("_perms") && (modelobj.schema.get("_perms").admin || modelobj.schema.get("_perms").user || modelobj.schema.get("_perms").owner || modelobj.schema.get("_perms").all)) {
					var model = {
						model: modelname,
						file: file,
						perms: modelobj.schema.get("_perms"),
					};
					models.push(model);
				}
			} catch(error) {
				console.error("Error with model " + modelname, error);
			}
		});
		res.send(models);
	});
};

var metaModel = function(req, res) {
	res.send(req.Model.schema.paths);
};

// Utitlities

var getOne = function(Model, item_id, params) {
	var deferred = Q.defer();
	var query = Model.findById(item_id);
	if (params.populate) {
		query.populate(params.populate);
	}
	if (params.autopopulate) {
		for(var key in Model.schema.paths) {
			var path = Model.schema.paths[key];
			if ((path.instance == "ObjectID") && (path.options.ref)) {
				query.populate(path.path);
			}
		}
	}
	query.exec(function(err, item) {
		if (err) {
			console.error(err);
			deferred.reject({ code: 500, msg: err });
			// res.send(500, err);
			return;
		} else {
			if (!item || item._deleted) {
				console.error("Could not find document");
				deferred.reject({ code: 404, msg: "Could not find document" });
				return;
			}
			//Don't ever return passwords
			item = item.toObject();
			delete item.password;
			deferred.resolve(item);
		}
	});
	return deferred.promise;
};

function parseFilter(filter) {
	if (typeof(filter) == "object") {
		Object.keys(filter).forEach(function(key) {
			var val = filter[key];
			try {
				if (val.indexOf(":") !== -1) {
					var tmp = val.split(":");
					filter[key] = {};
					filter[key][tmp[0]] = tmp[1];
				}
				if (typeof(val) == "object") {
					result = parseFilter(val);
					filter[key] = {};
					for(var x = 0; x < result.length; x++) {
						filter[key][Object.keys(result[x])[0]]=result[x][Object.keys(result[x])[0]];
					}
				}
			} catch(err) {
				throw(err);
			}
		});
	}
	return filter;
}

var _deSerialize = function(data) {
	function assign(obj, keyPath, value) {
	// http://stackoverflow.com/questions/5484673/javascript-how-to-dynamically-create-nested-objects-using-object-names-given-by
		lastKeyIndex = keyPath.length - 1;
		for (var i = 0; i < lastKeyIndex; ++ i) {
			key = keyPath[i];
			if (!(key in obj))
				obj[key] = {};
			obj = obj[key];
		}
		obj[keyPath[lastKeyIndex]] = value;
	}
	for(var datum in data) {
		var matches = datum.match(/\[(.+?)\]/g);
		if (matches) {
			var params = matches.map(function(match) {
				return match.replace(/[\[\]]/g, "");
			});
			if (isNaN(params[0])) {
				params.unshift(datum.match(/(.+?)\[/)[1]);
				assign(data, params, data[datum]);
			}
		}
	}
};

var _populateItem = function(item, data) {
	_deSerialize(data);
	for(var prop in item) {
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
			while(data[prop + "[" + x + "]"]) {
				tmp.push(data[prop + "[" + x + "]"]);
				x++;
			}
			item[prop] = tmp;
		}
	}
};

var _versionItem = function(item) {
	if (item._version || item._version === 0) {
		item._version++;
	} else {
		item._version = 0;
	}
};

var _fixArrays = function(req, res, next) {
	if (req.body) {
		for(var i in req.body) {
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

var changeUrlParams = function(req, key, val) {
	var q = req.query;
	q[key] = val;
	var pathname = require("url").parse(req.url).pathname;
	return req.config.url + req.path() + "?" + querystring.stringify(q);
};

var JExpress = function(options) {
	var server = restify.createServer();
	//Set up config with default
	var config = {
		mongo: {
			server: "localhost",
			db: "openmembers",
		},
		url: "http://localhost:3001",
		callbacks: {
			put: function() {},
			post: function() {},
			delete: function() {},
			get: function() {},
			getOne: function() {},
		}
	};

	//Override config with passed in options
	for(var i in options) {
		config[i] = options[i];
	}

	//DB connection
	mongoose.connect('mongodb://' + config.mongo.server + '/' + config.mongo.db, function(err) {
	    if (err) {
	        console.log("Connection error", err);
	    }
	}, { db: { safe:true } }); // connect to our database

	// Set up our API server
	server.use(
		function crossOrigin(req,res,next){
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "X-Requested-With,Authorization");
			res.header("Access-Control-Allow-Methods", "OPTIONS,GET,POST,PUT,DELETE");
			res.header('Access-Control-Allow-Credentials', true);
			return next();
		}
	);

	server.use(restify.queryParser());
	server.use(restify.bodyParser());

	// Bind our config to req.config
	server.use(function(req, res, next) {
		req.config = config;
		next();
	});

	// Define our endpoints

	/* Our API endpoints */
	server.get('/api/:modelname', middlewareModel, security.auth, actionGet);
	server.get('/api/:modelname/:item_id', middlewareModel, security.auth, actionGetOne);
	server.post('/api/:modelname', middlewareModel, security.auth, middlewarePasswords, actionPost);
	server.put('/api/:modelname/:item_id', middlewareModel, security.auth, middlewarePasswords, actionPut);
	server.del('/api/:modelname/:item_id', middlewareModel, security.auth, actionDelete);

	/* Batch routes - ROLLED BACK FOR NOW */
	// server.post('/batch/create/:modelname', middlewareModel, security.auth, actionBatch);

	/* Call Methods in our models */
	server.get('/call/:modelname/:method_name', middlewareModel, security.auth, actionCall);
	server.post('/call/:modelname/:method_name', middlewareModel, security.auth, actionCall);
	server.get('/call/:modelname/:item_id/:method_name', middlewareModel, security.auth, actionCallItem);

	/* Login and authentication */
	server.post("/login/recover", login.recover);
	server.post("/login/reset", login.reset);
	server.post("/login/getjwt", security.apiKeyAuth, login.getJWT);
	server.get("/login/logout", login.logout);
	server.post("/login/logout", login.logout);
	server.get("/login/oauth/:provider", login.oauth);
	server.get("/login/oauth/callback/:provider", login.oauth_callback);
	server.post("/login", login.login);

	/* Groups */
	server.put("/groups/:user_id", security.apiKeyAuth, _fixArrays, groups.actionPut);
	server.post("/groups/:user_id", security.apiKeyAuth, _fixArrays, groups.actionPost);
	server.get("/groups/:user_id", security.apiKeyAuth, groups.actionGet);
	server.del("/groups/:user_id", security.apiKeyAuth, groups.actionDelete);

	/* Meta */
	server.get('/model/:modelname', middlewareModel, metaModel);
	server.get("/model", metaModels);
	return server;
};

module.exports = JExpress;