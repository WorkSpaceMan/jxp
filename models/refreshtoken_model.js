/* global JXPSchema ObjectId */
const config = require("config");

var RefreshTokenSchema = new JXPSchema({
    user_id: { type: ObjectId, index: true },
    refresh_token: { type: String, index: true },
    expires_in: { type: Number, default: config.refresh_token_expiry || 2678400 }, // In seconds
},
{
    perms: {
        admin: "crud",
        owner: "crud",
        user: "",
    }
});

RefreshTokenSchema.index({ "expire_at": 1 }, { expireAfterSeconds: config.refresh_token_expiry || 2678400 });

const RefreshToken = JXPSchema.model('RefreshToken', RefreshTokenSchema);
module.exports = RefreshToken;