/**
 * Load test environment before any JXP modules (mocha --require test/env.js).
 */
process.env.NODE_ENV = "test";

const path = require("path");
const dotenv = require("dotenv");

const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.test"), override: true });

process.env.MODEL_DIR = process.env.MODEL_DIR || "./dist/models";
process.env.PORT = process.env.PORT || "4005";
process.env.MONGO_CONNECTION_STRING =
	process.env.MONGO_CONNECTION_STRING || "mongodb://127.0.0.1/test";
process.env.LOG_FILE = process.env.LOG_FILE || "./logs/test.log";
process.env.CACHE_ENABLED = process.env.CACHE_ENABLED ?? "true";
process.env.CACHE_DEBUG = process.env.CACHE_DEBUG ?? "true";
process.env.CACHE_TTL = process.env.CACHE_TTL || "600";
process.env.QUERY_LIMITS_ENABLED = process.env.QUERY_LIMITS_ENABLED ?? "true";
process.env.QUERY_LIMITS_LARGE_COLLECTION_THRESHOLD =
	process.env.QUERY_LIMITS_LARGE_COLLECTION_THRESHOLD || "0";
process.env.QUERY_LIMITS_MAX = process.env.QUERY_LIMITS_MAX || "1000";
