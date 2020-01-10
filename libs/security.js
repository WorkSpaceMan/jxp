const bcrypt = require("bcryptjs");
const randToken = require("rand-token");
const path = require("path");
var APIKey = null;
var Token = null;
var Groups = null;
var User = null;

const init = function(config) {
	APIKey = require(path.join(config.model_dir, "apikey_model"));
	Groups = require(path.join(config.model_dir, "usergroups_model.js"));
	User = require(path.join(config.model_dir, "user_model"));
	Token = require(path.join(config.model_dir, "token_model"));
};

var basicAuthData = function(req) {
	if (!req.headers.authorization) {
		return false;
	}
	try {
		const authorization = req.headers.authorization.split(" ")[1];
		const decoded = new Buffer.from(authorization, "base64").toString();
		return decoded.split(":");
	} catch (err) {
		return false;
	}
};

const fail = function(res, code, message) {
	res.send(code, { status: "error", message });
};

const basicAuth = async ba => {
	try {
		if (!Array.isArray(ba) || ba.length !== 2) {
			throw("Basic Auth incorrectly formatted");
		}
		var email = ba[0];
		var password = ba[1];
		const user = await User.findOne({ email }).exec();
		if (!user) {
			throw(new Date(), `Incorrect username or password for ${email}`);
		}
		if (!await bcrypt.compare(password, user.password)) {
			throw(`Incorrect username or password for ${email}`);
		}
		return user;
	} catch(err) {
		console.error(new Date(), err);
		return Promise.reject(err);
	}
};

const apiKeyAuth = async apikey => {
	try {
		if (!apikey) throw("Missing apikey");
		const result = await APIKey.findOne({ apikey });
		if (!result) throw("Could not find apikey");
		const user = User.findOne({ _id: result.user_id });
		if (!user) throw("Could not find user associated to apikey");
		return user;
	} catch(err) {
		console.error(new Date(), err);
		return Promise.reject(err);
	}
};

const getGroups = async user_id => {
	try {
		const userGroup = await Groups.findOne({ user_id });
		var groups = userGroup && userGroup.groups ? userGroup.groups : [];
		return groups;
	} catch(err) {
		console.error(new Date(), err);
		return Promise.reject(err);
	}
};

const encPassword = password => {
	return bcrypt.hashSync(password, 4);
};

const generateApiKey = async user => {
	try {
		let existing = await APIKey.findOne({ user_id: user._id }).sort({ last_accessed: -1 }).exec();
		if (existing) {
			await existing.updateOne({ last_accessed: new Date() });
			return existing;
		}
		var apikey = new APIKey();
		apikey.user_id = user._id;
		apikey.apikey = randToken.generate(16);
		await apikey.save();
		return apikey;
	} catch(err) {
		console.error(new Date(), err);
		return Promise.reject(err);
	}
};

const generateToken = async user => {
	try {
		var token = new Token();
		token.user_id = user._id;
		token.access_token = randToken.generate(16);
		await token.save();
		return token;
	} catch(err) {
		console.error(new Date(), err);
		return Promise.reject(err);
	}
};

const login = async (req, res, next) => {
	let user = null;
	if (!req.query.apikey && !req.headers.authorization) {
		// Anonymous user
		res.user = null;
		res.groups = [];
		return next();
	}
	try {
		if (req.headers.authorization) {
			// Basic Auth
			user = await basicAuth(basicAuthData(req));
		} else {
			// API Key
			user = await apiKeyAuth(req.query.apikey)
		}
		let groups = await getGroups(user._id);
		res.groups = groups;
		res.user = user;
		return next();
	} catch(err) {
		console.error(new Date(), err);
		return fail(res, 403, err);
	}
};

const auth = (req, res, next) => {
	// console.log("Started Auth");
	// Check against model as to whether we're allowed to edit this model
	if (!req.Model) {
		console.error("Model missing");
		return fail(res, 500, "Model missing");
	}
	try {
		const perms = req.Model.schema.get("_perms");
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
		if (req.method == "GET" || req.route.name === "postquerymodelname") {
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
		res.authorized = false;
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
		if (!res.user) {
			return fail(res, 403, "Unauthorized");
		}
		//Let's check perms in this order - admin, user, group, owner
		//Admin check
		if (res.user.admin && perms.admin && perms.admin.indexOf(method) !== -1) {
			// console.log("Matched permission 'admin':" + method);
			res.authorized = true;
			next();
			return;
		}
		//User check
		if (perms.user && perms.user.indexOf(method) !== -1) {
			// console.log("Matched permission 'user':" + method);
			res.authorized = true;
			next();
			return;
		}
		//Group check
		for (let group of res.groups) {
			if (perms[group] && perms[group].indexOf(method) !== -1) {
				// console.log("Matched permission '" + group + "':" + method);
				res.authorized = true;
				next();
				return;
			}
		}
		//Owner check
		req.Model.findById(req.params.item_id, function(err, item) {
			if (err) {
				console.error(err);
				return fail(res, 500, err);
			}
			if (
				item &&
				item._owner_id &&
				item._owner_id.toString() == res.user._id.toString() &&
				(perms.owner && perms.owner.indexOf(method) !== -1)
			) {
				res.authorized = true;
				next();
				return;
			} else {
				if (!res.authorized) {
					return fail(res, 403, "Authorization failed");
				}
			}
		});
	} catch(err) {
		console.error("An unknown error occured", err);
		return fail(res, 500, "An unknown error occured");
	}
};

const admin_only = (req, res, next) => { // Chain after login
	if (!res.user) {
		return fail(res, 403, "Unauthorized");
	}
	if (!res.user.admin) {
		return fail(res, 403, "Unauthorized");
	}
	next();
}

const Security = {
	init,
	basicAuthData,
	encPassword,
	generateApiKey,
	generateToken,
	login,
	auth,
	admin_only
};

module.exports = Security;
