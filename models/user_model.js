var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var friendly = require("mongoose-friendly");

var ObjectId = mongoose.Schema.Types.ObjectId;
var Mixed = mongoose.Schema.Types.Mixed;

var UserSchema   = new Schema({
	name: { type: String },
	urlid: { type: String, unique: true, index: true },
	email: { type: String, unique: true, index: true, set: toLower },
	password: String,
	admin: Boolean,
	temp_hash: String,
	date_created: { type: Date, default: Date.now },
	_owner_id: ObjectId,
	_deleted: { type: Boolean, default: false, index: true },
});

UserSchema.set("_perms", {
	admin: "crud",
	owner: "cru",
	user: "r",
	member: "r",
	api: "r"
});

var UserModel = mongoose.model('User', UserSchema);

UserSchema.path('name').validate(function (v) {
	return (v) && (v.length > 0);
}, 'Name cannot be empty');

UserSchema.plugin(friendly, {
	source: 'name',
	friendly: 'urlid'
});

function toLower (v) {
	if (v)
		return v.toLowerCase();
	return null;
}

module.exports = mongoose.model('User', UserSchema);