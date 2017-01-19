var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;

var TokenSchema   = new Schema({
	user_id: { type: ObjectId, index: true },
	provider: String,
	access_token: String,
	token_type: String,
	expires_in: Number,
	created: { type: Date, default: Date.now },
	_owner_id: ObjectId,
});

TokenSchema.set("_perms", {
	admin: "crud",
	owner: "crud",
	user: "",
});

module.exports = mongoose.model('Token', TokenSchema);