const bcrypt = require("bcryptjs");
const rand_token = require("rand-token");
const mongoose = require("mongoose");
const path = require("path");
const security = require("./security");

var init = config => {
	User = require(path.join(config.model_dir, "user_model"));
};

var checkUserDoesNotExist = (req, res, next) => {
	User.count((err, result) => {
		if (err) {
			console.log("Error:", err.message);
			return res.send({ status: "failed", error: err.message });
		} else {
			if (result)
				return res.send({
					status: "failed",
					error: "Cannot setup if user exists"
				});
			return next();
		}
	});
};

var setup = (req, res, next) => {
	var user = new User();
	var password =
		req.body && req.body.password
			? req.body.password
			: rand_token.generate(12);
	user.email =
		req.body && req.body.password ? req.body.email : "admin@jexpress.com";
	user.password = security.encPassword(password);
	user.name = req.body && req.body.name ? req.body.name : "admin";
	user.admin = true;
	user.save((err, result) => {
		if (err) {
			console.log("Error:", err.message);
			res.send({ status: "failed", error: err.message });
		} else {
			console.log(
				"Created admin user",
				user.name,
				"<" + user.email + ">",
				":",
				password
			);
			res.send({
				status: "success",
				name: user.name,
				email: user.email,
				password
			});
		}
	});
};

module.exports = {
	init,
	checkUserDoesNotExist,
	setup
};
