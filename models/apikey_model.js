var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;
var config		 = require("../config");

var Objectid = mongoose.Schema.Types.ObjectId;

var APIKeySchema   = new Schema({
	user_id: Objectid,
	apikey: String,
	created: { type: Date, default: Date.now, expires: config.apikey_lifespan || 86400 },
});

APIKeySchema.set("_perms", {
	//We can never change or view this directly
});

module.exports = mongoose.model('APIKey', APIKeySchema);