const bcrypt = require("bcryptjs");
const randToken = require("rand-token");
const path = require("path");
var APIKey = null;
var Token = null;
var Groups = null;
var User = null;
var RefreshToken = null;

const init = function(config) {
	APIKey = require(path.join(config.model_dir, "apikey_model"));
	Groups = require(path.join(config.model_dir, "usergroups_model.js"));
	User = require(path.join(config.model_dir, "user_model"));
	Token = require(path.join(config.model_dir, "token_model"));
	RefreshToken = require(path.join(config.model_dir, "refreshtoken_model"));
};

const fail = function (res, code, message) {
	res.send(code, { status: "error", message });
};

const basicAuthData = function(req) {
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

const bearerAuthData = req => {
	if (!req.headers.authorization) {
		return false;
	}
	try {
		const token = req.headers.authorization.split(" ")[1];
		return token;
	} catch (err) {
		return false;
	}
}

const bearerAuth = async t => {
	try {
		if (!t) throw("Token invalid");
		const token = await Token.findOne({ access_token: t }).exec();
		if (!token) {
			throw(`Token ${t} not found`);
		}
		if (!tokenIsValid(token)) {
			throw(`Token is no loger valid`);
		}
		const user = await User.findOne({ _id: token.user_id }).exec();
		if (!user) {
			throw (`Could not find user`);
		}
		return user;
	} catch (err) {
		console.error(err);
		return Promise.reject(err);
	}
}

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

const generateApiKey = async user_id => {
	try {
		let existing = await APIKey.findOne({ user_id }).sort({ last_accessed: -1 }).exec();
		if (existing) {
			await existing.updateOne({ last_accessed: new Date() });
			return existing;
		}
		var apikey = new APIKey();
		apikey.user_id = user_id;
		apikey.apikey = randToken.generate(16);
		await apikey.save();
		return apikey;
	} catch(err) {
		console.error(new Date(), err);
		return Promise.reject(err);
	}
};

const tokenIsValid = token => {
	if (!token) return false;
	const now = +new Date();
	const expires_at = +new Date(token.createdAt) + (token.expires_in * 1000);
	return (expires_at > now);
}

const tokenExpires = token => {
	return new Date(new Date(token.createdAt) + (token.expires_in * 1000));
}

const generateToken = async user_id => {
	try {
		var token = new Token();
		token.user_id = user_id;
		token.access_token = randToken.generate(16);
		await token.save();
		return token;
	} catch (err) {
		console.error(new Date(), err);
		return Promise.reject(err);
	}
};

const ensureToken = async user_id => {
	const token = await Token.findOne({ user_id }).exec();
	if (tokenIsValid(token)) {
		return token;
	}
	return await generateToken(user_id);
}

const refreshToken = async user_id => {
	await revokeToken(user_id);
	return await ensureToken(user_id);
}

const revokeToken = async user_id => {
	await Token.deleteOne({ user_id });
	return true;
}

const generateRefreshToken = async user_id => {
	try {
		var refreshtoken = new RefreshToken();
		refreshtoken.user_id = user_id;
		refreshtoken.refresh_token = randToken.generate(16);
		await refreshtoken.save();
		return refreshtoken;
	} catch (err) {
		console.error(new Date(), err);
		return Promise.reject(err);
	}
};

const ensureRefreshToken = async user_id => {
	const refreshtoken = await RefreshToken.findOne({ user_id }).exec();
	if (tokenIsValid(refreshtoken)) {
		return refreshtoken;
	}
	return await generateRefreshToken(user_id);
}

const revokeRefreshToken = async user_id => {
	await RefreshToken.deleteOne({ user_id });
	return true;
}

const refresh = async (req, res, next) => {
	try {
		if(req.headers.authorization && req.headers.authorization.trim().toLowerCase().indexOf("bearer") === 0) {
			const refresh_token = await RefreshToken.findOne({ refresh_token: bearerAuthData(req) }).exec();
			if (!refresh_token) throw("Refresh token not found");
			if (!tokenIsValid(refresh_token)) throw("Refresh token has expired");
			const user_id = refresh_token.user_id;
			const token = await refreshToken(user_id);
			await revokeRefreshToken(user_id);
			const new_refresh_token = await generateRefreshToken(user_id);
			res.send({
				user_id: user_id,
				token: token.access_token,
				token_expires: tokenExpires(token),
				refresh_token: new_refresh_token.refresh_token,
				refresh_token_expires: tokenExpires(new_refresh_token)
			});
			next();
		} else {
			throw("Missing refresh token")
		}
		next();
	} catch (err) {
		console.error(err);
		return fail(res, 403, err);
	}
}

const login = async (req, res, next) => {
	try {
		const authenticate_result = await authenticate(req);
		if (!authenticate_result) {
			res.user = null;
			res.groups = [];
			return next();
		}
		res = Object.assign(res, authenticate_result);
		next();
	} catch(err) {
		console.error(err);
		return fail(res, 403, err);
	}
};

const authenticate = async req => {
	let user = null;
	if (!req.query.apikey && !req.headers.authorization && !(req.headers["X-API-Key"] || req.headers["x-api-key"])) {
		return false;
	}
	try {
		if (req.headers.authorization && req.headers.authorization.trim().toLowerCase().indexOf("basic") === 0) {
			// Basic Auth
			user = await basicAuth(basicAuthData(req));
		} else if (req.headers.authorization && req.headers.authorization.trim().toLowerCase().indexOf("bearer") === 0) {
			// Token Auth
			user = await bearerAuth(bearerAuthData(req));
		} else if (req.query.apikey) {
			user = await apiKeyAuth(req.query.apikey);
		} else if (req.headers["X-API-Key"] || req.headers["x-api-key"]) {
			// API Key
			user = await apiKeyAuth(req.query.apikey || req.headers["X-API-Key"] || req.headers["x-api-key"])
		} else {
			throw ("Could not find any way to authenticate");
		}
		if (!user) {
			throw ("Could not find user");
		}
		return {
			token: await ensureToken(user._id),
			refresh_token: await ensureRefreshToken(user._id),
			groups: await getGroups(user._id),
			user
		}
	} catch (err) {
		return Promise.reject(err);
	}
}

const auth = async (req, res, next) => {
	// Check against model as to whether we're allowed to edit this model
	if (!req.Model) {
		console.error("Model missing");
		return fail(res, 500, "Model missing");
	}
	try {
		
		var method = null;
		// console.log("req.route.name", req.route.name);
		if (req.method == "GET" || req.route.name === "postquerymodelname" || req.route.name === "postaggregatemodelname") {
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
		await check_perms(res.user, res.groups, req.Model, method, req.params.item_id);
		next();
	} catch(err) {
		console.error(err);
		return fail(res, 403, { status: "Unauthorized", error: err });
	}
};

const check_perms = async (user, groups, model, method, item_id) => {
	try {
		const perms = model.schema.get("_perms");
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
		//If no perms are set, then this isn't an available model
		if (!perms.admin) {
			console.error("Model not available");
			throw("Model not available");
		}
		//First check if "all" is able to do this. If so, let's get on with it.
		if (perms.all) {
			if (perms.all.indexOf(method) !== -1) {
				return true;
			}
		}
		//This isn't an 'all' situation, so let's bail if the user isn't logged in
		if (!user) {
			throw("Unauthorized");
		}
		//Let's check perms in this order - admin, user, group, owner
		//Admin check
		if (user.admin && perms.admin && perms.admin.includes(method)) {
			// console.log("Matched permission 'admin':" + method);
			return true;
		}
		//User check
		if (perms.user && perms.user.includes(method)) {
			// console.log("Matched permission 'user':" + method);
			return true;
		}
		//Group check
		for (let group of groups) {
			if (perms[group] && perms[group].includes(method) ) {
				// console.log("Matched permission '" + group + "':" + method);
				return true;
			}
		}
		//Owner check
		if (!item_id) throw ("Authorization failed");
		const item = await model.findById(item_id);
		if (item && item._owner_id && item._owner_id.toString() == user._id.toString() && (perms.owner && perms.owner.includes(method))) return true;
		throw ("Authorization failed");
	} catch (err) {
		return Promise.reject(err);
	}
}

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
	basicAuth,
	encPassword,
	generateApiKey,
	generateToken,
	ensureToken,
	refreshToken,
	revokeToken,
	tokenExpires,
	generateRefreshToken,
	ensureRefreshToken,
	revokeRefreshToken,
	login,
	refresh,
	authenticate,
	auth,
	admin_only,
	check_perms,
	getGroups,
	apiKeyAuth,
	bearerAuth,
};

module.exports = Security;
