var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var TokenSchema   = new Schema({
	user_id: { type: Objectid, index: true },
	provider: String,
	access_token: String,
	token_type: String,
	expires_in: Number,
	created: { type: Date, default: Date.now },
	_owner_id: Objectid,
});

TokenSchema.set("_perms", {
	admin: "crud",
	owner: "crud",
	user: "",
});

module.exports = mongoose.model('Token', TokenSchema);