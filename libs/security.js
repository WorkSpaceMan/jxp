var Q = require("q");
var bcrypt = require("bcryptjs");
var APIKey = null;
var Groups = null;
var User = null;

var init = function(config) {
	var path = require("path");
	APIKey = require(path.join(config.model_dir, "apikey_model"));
	Groups = require(path.join(config.model_dir, "usergroups_model.js"));
	User = require(path.join(config.model_dir, "user_model"));
};

var basicAuthData = function(req) {
	if (!req.headers.authorization) {
		return false;
	}
	try {
		auth = req.headers.authorization.split(" ")[1];
	} catch (err) {
		return false;
	}
	decoded = new Buffer(auth, "base64").toString();
	return decoded.split(":");
};

var fail = function(res, code, message) {
	res.send(code, { status: "error", message: message });
};

var basicAuth = ba => {
	return new Promise((resolve, reject) => {
		if (!Array.isArray(ba) || ba.length !== 2) {
			return reject("Basic Auth incorrectly formatted");
		}
		var email = ba[0];
		var password = ba[1];
		User.findOne({ email }, function(err, user) {
			if (err) {
				console.error(err);
				return reject(err);
			}
			if (!user) {
				console.error("Incorrect username");
				return reject("Incorrect username or password");
			}
			try {
				if (!bcrypt.compareSync(password, user.password)) {
					console.error("Incorrect password");
					return reject("Incorrect username or password");
				}
			} catch (e) {
				console.error(e);
				return reject(e);
			}
			return resolve(user);
		});
	});
};

var apiKeyAuth = apikey => {
	return new Promise((resolve, reject) => {
		if (!apikey) return reject("Missing apikey");
		APIKey.findOne({ apikey }, function(err, result) {
			if (err) return reject(err);
			if (!result) return reject("Could not find apikey");
			User.findOne({ _id: result.user_id }, function(err, user) {
				if (err) return reject(err);
				if (!user)
					return reject("Could not find user associated to apikey");
				return resolve(user);
			});
		});
	});
};

var getGroups = user_id => {
	return new Promise((resolve, reject) => {
		Groups.findOne({ user_id }, (err, userGroup) => {
			if (err) {
				console.error(err);
				return reject(err);
			}
			var groups = userGroup && userGroup.groups ? userGroup.groups : [];
			return resolve(groups);
		});
	});
};

var encPassword = password => {
	hash = bcrypt.hashSync(password, 4);
	return hash;
};

var generateApiKey = user => {
	return new Promise((resolve, reject) => {
		var apikey = new APIKey();
		apikey.user_id = user._id;
		apikey.apikey = require("rand-token").generate(16);

		apikey.save(function(err) {
			if (err) {
				console.error(err);
				return reject(err);
			}
			return resolve(apikey);
		});
	});
};

var login = (req, res, next) => {
	if (req.headers.authorization) {
		// Basic Auth
		var ba = basicAuthData(req);
		basicAuth(ba)
			.then(user => {
				req.user = user;
				return getGroups(user._id);
			})
			.then(groups => {
				req.groups = groups;
				next();
			})
			.catch(err => {
				console.error(err);
				return fail(res, 403, err);
			});
	} else if (req.query.apikey) {
		// APIKey
		apiKeyAuth(req.query.apikey)
			.then(user => {
				req.user = user;
				return getGroups(user._id);
			})
			.then(groups => {
				req.groups = groups;
				next();
			})
			.catch(err => {
				console.error(err);
				return fail(res, 403, err);
			});
	} else {
		// No login details
		req.user = null;
		req.groups = [];
		next();
	}
};

var auth = (req, res, next) => {
	// console.log("Started Auth");
	// Check against model as to whether we're allowed to edit this model
	var perms = req.Model.schema.get("_perms");
	var passed = {
		admin: false,
		owner: false,
		user: false,
		all: false
	};
	for (var i in perms) {
		// Add any user-defined perms to our passed table
		passed[i] = false;
	}
	var method = null;
	if (req.method == "GET") {
		method = "r";
	} else if (req.method == "POST") {
		method = "c";
	} else if (req.method == "PUT") {
		method = "u";
	} else if (req.method == "DELETE") {
		method = "d";
	} else {
		console.error("Unsupported operation", req.method);
		return fail(res, 500, "Unsupported operation: " + req.method);
	}
	req.authorized = false;
	//If no perms are set, then this isn't an available model
	if (!perms.admin) {
		console.error("Model not available");
		return fail(res, 500, "Model not available");
	}
	//First check if "all" is able to do this. If so, let's get on with it.
	if (perms.all) {
		if (perms.all.indexOf(method) !== -1) {
			next();
			return;
		}
	}

	//This isn't an 'all' situation, so let's bail if the user isn't logged in
	if (!req.user) {
		return fail(res, 403, "Unauthorized");
	}

	//Let's check perms in this order - admin, user, group, owner
	//Admin check
	if (req.user.admin && perms.admin && perms.admin.indexOf(method) !== -1) {
		// console.log("Matched permission 'admin':" + method);
		req.authorized = true;
		next();
		return;
	}
	//User check
	if (perms.user && perms.user.indexOf(method) !== -1) {
		// console.log("Matched permission 'user':" + method);
		req.authorized = true;
		next();
		return;
	}
	//Group check
	req.groups.forEach(function(group) {
		if (perms[group] && perms[group].indexOf(method) !== -1) {
			// console.log("Matched permission '" + group + "':" + method);
			req.authorized = true;
			next();
			return;
		}
	});
	//Owner check
	var owner_id = false;
	req.Model.findById(req.params.item_id, function(err, item) {
		if (err) {
			console.error(err);
			return fail(res, 500, err);
		}
		if (
			item &&
			item._owner_id &&
			item._owner_id.toString() == req.user._id.toString() &&
			(perms.owner && perms.owner.indexOf(method) !== -1)
		) {
			// console.log("Matched permission 'owner':" + method);
			req.authorized = true;
			next();
			return;
		} else {
			// console.error("All authorizations failed");
			if (!req.authorized) {
				return fail(res, 403, "Authorization failed");
			}
		}
	});
};

var Security = {
	init,
	basicAuthData,
	encPassword,
	generateApiKey,
	login,
	auth
};

module.exports = Security;
