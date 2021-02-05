const rand_token = require("rand-token");
const path = require("path");
const security = require("./security");
var User = null;
var connection_string = null;

const init = config => {
	User = require(path.join(config.model_dir, "user_model"));
	connection_string = config.mongo.connection_string;
}

const checkUserDoesNotExist = async (req, res, next) => {
	try {
		const count = await User.countDocuments();
		if (count) {
			const users = await User.find();
			return res.send(403, { status: "failed", error: "Cannot setup if user exists" });
		}
		return next();
	} catch(err) {
		console.error(err);
		res.send(500, { status: "error", error: err.message });
	}
};

const setup = async (req, res) => {
	try {
		const password = (req.body && req.body.password) ? req.body.password : rand_token.generate(12);
		const user = new User({
			password: security.encPassword(password),
			email: req.body.email || "admin@example.com",
			name: req.body.name || "admin",
			admin: true
		});
		await user.save();
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
	} catch(err) {
		console.error(err);
		res.send(500, { status: "error", error: err.message });
	}
};

// Unlike setup, which just automates user creation, you can upload any data you want
const data_setup = async (req, res) => {
	try {
		const { MongoClient } = require("mongodb");
		const client = new MongoClient(connection_string);
		await client.connect();
		const db = client.db(client.s.options.dbName);
		const data = req.body;
		const results = {};
		for (let collection in data) {
			const result = await db.collection(collection).insertMany(data[collection]);
			results[collection] = result;
		}
		res.send({ status: "success", results });
	} catch(err) {
		console.error(err);
		res.send(500, { status: "error", error: err.message });
	}
}

module.exports = {
	init,
	checkUserDoesNotExist,
	setup,
	data_setup
};
