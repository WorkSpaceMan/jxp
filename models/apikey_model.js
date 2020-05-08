/* global ObjectId */
var Schema       = require("../libs/schema");

var APIKeySchema   = new Schema({
	user_id: { type: ObjectId, index: true },
	apikey: { type: String, index: true, unique: true },
	last_accessed: { type: Date, default: Date.now, index: true },
});

const APIKey = Schema.model('APIKey', APIKeySchema);
module.exports = APIKey;