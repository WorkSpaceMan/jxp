require("dotenv").config();
const mongoose = require("mongoose");
const JXP = require("jxp");
const { loadJxpConfig, getMongoConnectionString } = require("jxp/libs/load-config");

const apiconfig = loadJxpConfig();

apiconfig.callbacks = {
	post: function () {},
	put: function () {},
	delete: function () {},
};

apiconfig.pre_hooks = {
	login: (req, res, next) => next(),
	get: (req, res, next) => next(),
	getOne: (req, res, next) => next(),
	post: (req, res, next) => next(),
	put: (req, res, next) => next(),
	delete: (req, res, next) => next(),
};

mongoose.Promise = Promise;
const mongo_options = Object.assign({}, apiconfig.mongo?.options || {}, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

mongoose.connect(getMongoConnectionString(), mongo_options);

mongoose.connection.on("error", console.error.bind(console, "connection error:"));
mongoose.connection.once("open", () => {
	console.log(`Connected to Mongo at: ${new Date()}`);
});

const server = JXP(apiconfig);
const port = parseInt(process.env.PORT || String(apiconfig.port || 4001), 10);

server.listen(port, function () {
	console.log("%s listening at %s", server.name, server.url);
});

module.exports = server;
