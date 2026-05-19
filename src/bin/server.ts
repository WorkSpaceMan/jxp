/*
=================
JXP - Express API
=================

Documentation:
https://jxp.readthedocs.io/en/latest/

*/

import "../libs/startup-deprecations";
import path from "path";
import mongoose from "mongoose";
import JXP = require("../libs/jxp");
import { loadJxpConfig, getMongoConnectionString } from "../libs/load-config";
import { printBanner, printBooting, printReady } from "../libs/startup";
import pkg from "../../package.json";

const apiconfig = loadJxpConfig();
apiconfig.quiet_startup = true;

apiconfig.callbacks = {
	post: function () {},
	put: function () {},
	delete: function () {},
};

apiconfig.pre_hooks = {
	login: (_req, _res, next) => {
		next();
	},
	get: (_req, _res, next) => {
		next();
	},
	getOne: (_req, _res, next) => {
		next();
	},
	post: (_req, _res, next) => {
		next();
	},
	put: (_req, _res, next) => {
		next();
	},
	delete: (_req, _res, next) => {
		next();
	},
};

mongoose.Promise = Promise;
mongoose.set("strictQuery", true);

if (!apiconfig.mongo) apiconfig.mongo = {};
if (!apiconfig.mongo.options) apiconfig.mongo.options = {};
const mongo_options = Object.assign(apiconfig.mongo.options, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverSelectionTimeoutMS: 10000,
	socketTimeoutMS: 45000,
	maxPoolSize: process.env.NODE_ENV === "test" ? 20 : 50,
	minPoolSize: process.env.NODE_ENV === "test" ? 5 : 10,
	maxIdleTimeMS: 30000,
	connectTimeoutMS: 10000,
	heartbeatFrequencyMS: 10000,
	retryWrites: true,
	retryReads: true,
});

const connection_string = getMongoConnectionString();
const startupCtx = {
	name: pkg.name,
	version: pkg.version,
	mongoUri: connection_string,
	accessLog: path.resolve(apiconfig.log || "access.log"),
	maxPoolSize: mongo_options.maxPoolSize as number,
};

printBanner(startupCtx);
printBooting(startupCtx);

mongoose.connect(connection_string, mongo_options);

const db = mongoose.connection;
let mongoConnectedAt: Date | null = null;
let httpUrl: string | null = null;
let readyPrinted = false;

db.on("error", (err) => {
	console.error("MongoDB connection error:", err);
	if (err.name === "MongoNetworkError") {
		console.error("Network error occurred. Attempting to reconnect...");
	}
});

db.once("open", () => {
	mongoConnectedAt = new Date();
	maybePrintReady();
});

mongoose.connection.on("disconnected", () => {
	console.log("Mongoose disconnected");
	setTimeout(() => {
		Promise.resolve(mongoose.connect(connection_string, mongo_options)).catch((err: Error) => {
			console.error("Failed to reconnect to MongoDB:", err);
		});
	}, 5000);
});

mongoose.connection.on("error", (err) => {
	console.error("Mongoose connection error:", err);
});

setInterval(() => {
	const client = mongoose.connection.getClient?.();
	const pool =
		(client as { topology?: { s?: { pool?: { totalConnectionCount?: number } } } })?.topology?.s
			?.pool?.totalConnectionCount ?? 0;
	const maxPoolSize = mongo_options.maxPoolSize as number;
	if (pool > 0 && pool > maxPoolSize * 0.8) {
		console.warn(`Connection pool is at ${Math.round((pool / maxPoolSize) * 100)}% capacity`);
	}
}, 30000);

const server = JXP(apiconfig);

let port = process.env.NODE_DOCKER_PORT || process.env.PORT || String(apiconfig.port || 4001);
if (process.env.NODE_ENV === "test") port = "4005";
server.listen(parseInt(String(port), 10), function () {
	httpUrl = server.url;
	maybePrintReady();
});

function maybePrintReady(): void {
	if (readyPrinted || !mongoConnectedAt || !httpUrl) return;
	readyPrinted = true;
	printReady({
		...startupCtx,
		url: httpUrl,
		mongooseVersion: mongoose.version,
		mongoConnectedAt,
	});
}

export = server;
