var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var UserGroupSchema   = new Schema({
	user_id: Objectid,
	groups: [String],
	_date: { type: Date, default: Date.now },
});

UserGroupSchema.set("_perms", {
	admin: "crud",
	user: "r",
});

module.exports = mongoose.model('Usergroup', UserGroupSchema);