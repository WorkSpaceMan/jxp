/* global JXPSchema ObjectId */
const config = require("config");

var TokenSchema = new JXPSchema({
	user_id: { type: ObjectId, index: true },
	provider: String,
	access_token: { type: String, index: true },
	token_type: String,
	expires_in: { type: Number, default: config.token_expiry || 86400, required: true }, // In seconds
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

const Token = JXPSchema.model('Token', TokenSchema);
module.exports = Token;