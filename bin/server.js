/*
=================
JXP - Express API
=================

Documentation:
https://jxp.readthedocs.io/en/latest/

*/

const mongoose = require("mongoose");
const JXP = require("../libs/jxp");
const config = require("config");
require("dotenv").config();
const pkg = require("../package.json");

config.callbacks = {
	// Examples:
	// post: function(modelname, item, user) {
	// 	console.log("Post callback");
	// },
	// put: function(modelname, item, user) {
	// 	console.log("Put callback");
	// },
	// delete: function(modelname, item, user, opts) {
	// 	console.log("Delete callback");
	// }

	post: function() {},
	put: function() {},
	delete: function() {}
};

config.pre_hooks = {
	login: (req, res, next) => {
		next();
	},
	get: (req, res, next) => {
		next();
	},
	getOne: (req, res, next) => {
		next();
	},
	post: (req, res, next) => {
		next();
	},
	put: (req, res, next) => {
		next();
	},
	delete: (req, res, next) => {
		next();
	},
};

// ES6 promises
mongoose.Promise = Promise;
if (!config.mongo) config.mongo = {};
if (!config.mongo.options) config.mongo.options = {};
const mongo_options = Object.assign(config.mongo.options, {});

const connection_string = require("../libs/connection_string");
console.log(`Connecting to ${connection_string}`);
mongoose.connect(connection_string, mongo_options);

const db = mongoose.connection;

// mongodb error
db.on('error', console.error.bind(console, 'connection error:'));

// mongodb connection open
db.once('open', () => {
	console.log(`Connected to Mongo at: ${new Date()}`);
});

var server = new JXP(config);

let port = process.env.NODE_DOCKER_PORT || process.env.PORT || config.port || 4001;
if (process.env.NODE_ENV === "test") port = 4005;
server.listen(port, function() {
	console.log('%s listening at %s', `${pkg.name} v${pkg.version}`, server.url);
	console.log(`Mongoose version ${mongoose.version}`);
});

module.exports = server; // For testing
