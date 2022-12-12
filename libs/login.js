const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const security = require("../libs/security");
const nodemailer = require('nodemailer');
const errors = require("restify-errors");
const smtpTransport = require('nodemailer-smtp-transport');
const path = require("path");
let User = null;

var init = function (config) {
	User = require(path.join(config.model_dir, 'user_model'));
	security.init(config);
};

const recover = async (req, res) => {
	try {
		// create reusable transporter object using SMTP transport
		const transporter = nodemailer.createTransport(smtpTransport({
			host: req.config.smtp_server,
			port: 25,
			auth: {
				user: req.config.smtp_username,
				pass: req.config.smtp_password,
			},
			// secure: true,
			tls: { rejectUnauthorized: false }
		}));
		const email = req.body.email;
		if (!email) {
			console.error("Missing email parameter");
			throw new errors.BadRequestError("Missing email parameter");
		}
		const user = await User.findOne({ email });
		if (!user) {
			throw new errors.NotFoundError(`User with email ${email} Not Found`);
		}
		const result = await security.generateApiKey(user._id);
		const token = jwt.sign({ apikey: result.apikey, email: user.email, id: user._id }, req.config.shared_secret, { expiresIn: "2d" });
		var text = `Someone (hopefully you) requested a password reset. Please click on the following url to recover your password. If you did not request a password reset, you can ignore this message. \n${req.config.password_recovery_url}/${token}`;
		var html = text;
		var mail_format = req.params.mail_format || req.body.mail_format;
		if (mail_format) {
			html = mail_format;
			html = html.replace(/\{\{recover_url\}\}/i, req.config.password_recovery_url + "/" + token);
		}
		transporter.sendMail({
			from: req.config.smtp_from,
			to: user.email,
			subject: "Password Recovery",
			text: text,
			html: html
		}, function (result) {
			console.log({ msg: "Mailer result", result });
		});
		res.send({ status: "ok", message: "Sent recovery email" });
	} catch (err) {
		if (err.code) throw err;
		throw new errors.UnauthorizedError(err.toString());
	}
}

const logout = async (req, res) => {
	try {
		if (!res.user) throw new errors.ForbiddenError("You don't seem to be logged in");
		await security.revokeToken(res.user._id);
		res.send({ status: "ok", message: "User logged out" });
	} catch(err) {
		console.error(err);
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
	}
}

const oauth = (req, res, next) => { // Log in through an OAuth2 provider, defined in config.js
	const provider_config = req.config.oauth[req.params.provider];
	if (!provider_config) {
		throw new errors.InternalServerError(`oAuth ${req.params.provider} config not defined`);
	}
	const state = Math.random().toString(36).substring(7);
	const uri = `${provider_config.auth_uri}?client_id=${provider_config.app_id}&redirect_uri=${req.config.url}/login/oauth/callback/${req.params.provider}&scope=${provider_config.scope}&state=${state}&response_type=code`;
	res.redirect(uri, next);
}

const oauth_callback = async (req, res) => {
	const provider = req.params.provider;
	const provider_config = req.config.oauth[provider];
	const code = req.query.code;
	try {
		if (req.query.error) {
			throw (req.query.error);
		}
		if (!code) {
			throw ("missing_code");
		}
		const token = (await axios.post(provider_config.token_uri, {
			client_id: provider_config.app_id,
			redirect_uri: `${req.config.url}/login/oauth/callback/${req.params.provider}`,
			client_secret: provider_config.app_secret,
			code: code,
			grant_type: "authorization_code"
		})).data;
		if (!token.access_token) {
			throw ("missing_access_token");
		}
		const data = (await axios.get(provider_config.api_uri, { headers: { Authorization: `Bearer ${token.access_token}` } })).data;
		if (data.emailAddress) {
			data.email = data.emailAddress;
		}
		if (data.elements && data.elements[0] && data.elements[0]["handle~"] && data.elements[0]["handle~"].emailAddress) { // LinkedIn
			data.email = data.elements[0]["handle~"].emailAddress;
		}
		if (!data.email) {
			throw ("missing_data");
		}
		var search = {};
		search[provider + ".id"] = data.id;
		const user = await User.findOne(search);
		if (!user) {
			throw ("no_user");
		}
		user[provider] = data;
		await user.save();
		const apikey = await security.generateApiKey(user._id)
		var jwt_token = jwt.sign({ apikey: apikey.apikey, user: user }, req.config.shared_secret, {
			expiresIn: "1m"
		});
		res.redirect(`${req.config.oauth.success_uri}?token=${jwt_token}`);
	} catch (err) {
		console.error(err);
		if (typeof err === 'string' || err instanceof String) {
			res.redirect(`${req.config.oauth.fail_uri}?error=${err}&provider=${provider}`);
		} else {
			res.redirect(`${req.config.oauth.fail_uri}?error=unknown&provider=${provider}`);
		}
		return;
	}
}

const login = async (req, res) => {
	const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	let email = req.params.email || req.body.email;
	let password = req.params.password || req.body.password;
	const userpass = security.basicAuthData(req);
	if (userpass) {
		email = userpass[0];
		password = userpass[1];
	}
	if ((!password) || (!email)) {
		console.error(new Date(), "Missing email or password parameters");
		return new errors.ForbiddenError("Missing email or password parameters");
	}
	try {
		const user = await User.findOne({ email });
		if (!user) throw (`Incorrect email; email: ${email}`);
		if (!(await bcrypt.compare(password, user.password))) {
			throw (`Incorrect password; email: ${email}`);
		}
		const token = await security.refreshToken(user._id);
		const refreshtoken = await security.ensureRefreshToken(user._id);
		const apikey = await security.generateApiKey(user._id)
		res.result = ({
			user_id: user._id,
			token: token.access_token,
			apikey: apikey.apikey,
			token_expires: security.tokenExpires(token),
			refresh_token: refreshtoken.refresh_token,
			refresh_token_expires: security.tokenExpires(refreshtoken),
			provider: token.provider,
		});
	} catch (err) {
		console.error(new Date(), `Authentication failed`, ip, err);
		if (err.code) throw err;
		return new errors.ForbiddenError(err.toString());
	}
}

const getJWT = async (req, res) => {
	var user = null;
	if (!res.user.admin) {
		throw new errors.UnauthorizedError("Unauthorized");
	}
	var email = req.params.email || req.body.email;
	if (!email) {
		throw new errors.BadRequestError("Email required");
	}
	try {
		const result = await User.findOne({ email: email });
		if (!result || !result._id) {
			throw new errors.NotFoundError("User not found");
		}
		user = result;
		try {
			const apikey = await security.generateApiKey(user._id)
			var token = jwt.sign({ apikey: apikey.apikey, email: user.email, id: user._id }, req.config.shared_secret, {
				expiresIn: "2d"
			});
			res.send({ email: user.email, token: token });
		} catch (err) {
			throw new errors.UnauthorizedError("Unauthorized");
		}
	} catch (err) {
		if (err.code) throw err;
		throw new errors.InternalServerError(err.toString());
	}
}

const Login = {
	init,
	recover,
	logout,
	oauth,
	oauth_callback,
	login,
	getJWT
};

module.exports = Login;
