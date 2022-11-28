const rand_token = require("rand-token");
const path = require("path");
const security = require("./security");
const ObjectID = require('mongodb').ObjectID;
var User = null;
const connection_string = require("./connection_string");

const init = config => {
	User = require(path.join(config.model_dir, "user_model"));
}

const checkUserDoesNotExist = async (req, res) => {
	try {
		const count = await User.countDocuments();
		if (count) {
			return res.send(403, { status: "failed", error: "Cannot setup if user exists" });
		}
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
		const client = await MongoClient.connect(connection_string);
		const db = client.db(client.databaseName);
		const data = req.body;
		const results = {};
		const _id_reg = new RegExp("_id$");
		for (let collection in data) {
			for (let row of data[collection]) {
				row.createdAt = new Date();
				row._deleted = false;
				// Ensure all _id's are of type id
				for (let field in row) {
					if (_id_reg.test(field)) {
						row[field] = ObjectID(row[field]);
					}
				}
			}
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
