/* global JXPSchema ObjectId */

var APIKeySchema   = new JXPSchema({
	user_id: { type: ObjectId, index: true, unique: true },
	apikey: { type: String, index: true, unique: true },
	last_accessed: { type: Date, default: Date.now, index: true },
});

const APIKey = JXPSchema.model('APIKey', APIKeySchema);
module.exports = APIKey;