const config = require("config");
require("dotenv").config();

// mongodb connection
const {
	MONGODB_USER,
	MONGODB_PASSWORD,
	MONGODB_HOST,
	MONGODB_PORT,
	MONGODB_NAME,
	MONGODB_AUTH_DB,
} = process.env;

// mongodb connection
let connection_string = `mongodb://localhost:27017/jxp`;
if (config.mongo && config.mongo.connection_string) {
	connection_string = config.mongo.connection_string;
	console.warn("`config` to be deprecated in favour of dotenv in future versions");
}
if (MONGODB_HOST) {
	connection_string = `mongodb://${ (MONGODB_USER && MONGODB_PASSWORD) ? `${MONGODB_USER}:${MONGODB_PASSWORD}@` : '' }${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_NAME}?${ (MONGODB_AUTH_DB) ? `authSource=${MONGODB_AUTH_DB}` : '' }`
}

module.exports = connection_string;