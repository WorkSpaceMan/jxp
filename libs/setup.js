const rand_token = require("rand-token");
const path = require("path");
const security = require("./security");
const config = require("config");
config.model_dir = config.model_dir || path.join(process.cwd(), "./models");
const User = require(path.join(config.model_dir, "user_model"));

var checkUserDoesNotExist = (req, res, next) => {
	User.countDocuments((err, result) => {
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

var setup = (req, res) => {
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
	user.save((err) => {
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
	checkUserDoesNotExist,
	setup
};
