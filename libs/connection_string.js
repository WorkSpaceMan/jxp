const config = require("config");
require("dotenv").config();

// mongodb connection
let connection_string = `mongodb://localhost:27017/jxp`;
if (config.mongo && config.mongo.connection_string) {
	connection_string = config.mongo.connection_string;
	console.warn("`config` to be deprecated in favour of dotenv in future versions");
}
if (process.env.DB_HOST) {
	connection_string = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.NODE_ENV === "test" ? "jxp-test" : process.env.DB_NAME}?authSource=admin`
}

module.exports = connection_string;