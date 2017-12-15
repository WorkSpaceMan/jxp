const config = require("config");
const bcrypt = require("bcrypt");
const rand_token = require("rand-token");
const mongoose = require("mongoose");
const User = require(path.join(config.model_dir, "user_model"));

var checkUserDoesNotExist = (req, res, next) => {
	config.mongo = config.mongo || { server: "localhost", db: "jexpress" };
	//DB connection
	mongoose.connect(
		"mongodb://" + config.mongo.server + "/" + config.mongo.db,
		function(err) {
			if (err) {
				console.log("Database connection error", err);
			}
		},
		{ db: { safe: true } }
	); // connect to our database
	User.count().then(result => {
		if (result)
			return res.send({
				status: "failed",
				error: "Cannot setup if user exists"
			});
		return next();
	});
};

var setup = (req, res, next) => {
	config.mongo = config.mongo || { server: "localhost", db: "jexpress" };
	//DB connection
	mongoose.connect(
		"mongodb://" + config.mongo.server + "/" + config.mongo.db,
		function(err) {
			if (err) {
				console.log("Database connection error", err);
			}
		},
		{ db: { safe: true } }
	); // connect to our database
	var user = new User();
	var password = req.body.password || rand_token.generate(12);
	user.email = req.body.email;
	user.password = security.encPassword(password);
	user.name = req.body.name || "admin";
	user.admin = true;
	user.save((err, result) => {
		if (err) {
			console.log("Error:", err.message);
			res.send({ status: "failed", error: err.message });
		} else {
			console.log(
				"Created admin user",
				name,
				"<" + email + ">",
				":",
				password
			);
			res.send({ status: "success", name, email, password });
		}
	});
};

module.exports = {
	checkUserDoesNotExist,
	setup
};
