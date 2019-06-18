var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;

var UserGroupSchema   = new Schema({
	user_id: { type: ObjectId, index: true, unique: true },
	groups: [String],
	_date: { type: Date, default: Date.now },
});

UserGroupSchema.set("_perms", {
	admin: "crud",
	user: "r",
});

module.exports = mongoose.model('Usergroup', UserGroupSchema);