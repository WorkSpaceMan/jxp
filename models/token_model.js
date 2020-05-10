/* global ObjectId */
const Schema = require("../libs/schema");
const config = require("config");

var TokenSchema   = new Schema({
	user_id: { type: ObjectId, index: true },
	provider: String,
	access_token: { type: String, index: true },
	token_type: String,
	expires_in: { type: Number, default: config.token_expiry || 86400 }, // In seconds
	last_accessed: { type: Date, default: Date.now, index: true },
},
{
	perms: {
		admin: "crud",
		owner: "crud",
		user: "",
	}
});

TokenSchema.index({ "expire_at": 1 }, { expireAfterSeconds: config.token_expiry || 86400 });

const Token = Schema.model('Token', TokenSchema);
module.exports = Token;