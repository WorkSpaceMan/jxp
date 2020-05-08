/* global ObjectId */
const Schema = require("../libs/schema");

var TokenSchema   = new Schema({
	user_id: { type: ObjectId, index: true },
	provider: String,
	access_token: String,
	token_type: String,
	expires_in: Number,
},
{
	perms: {
		admin: "crud",
		owner: "crud",
		user: "",
	}
});

const Token = Schema.model('Token', TokenSchema);
module.exports = Token;