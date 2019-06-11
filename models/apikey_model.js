var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;

var APIKeySchema   = new Schema({
	user_id: ObjectId,
	apikey: String,
	created: { type: Date, default: Date.now },
});

APIKeySchema.set("_perms", {
	//We can never change or view this directly
});

module.exports = mongoose.model('APIKey', APIKeySchema);