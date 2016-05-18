module.exports = {
	port: "{port}",
	url: "{url}",
	mongo: {
		server: "{mongo_server}",
		db: "{mongo_db}",
	},
	shared_secret: "{shared_secret}", // We use this to encrypt our JWT token, so it should be shared with our front-end site
	smtp_server: "mail.myserver.com",
	smtp_username: "me@myserver.com",
	smtp_password: "MyPassword",
	password_recovery_url: 'http://localhost:3000/login/reset',
	oauth: {
		success_uri: "http://localhost:3000/login/oauth",
		fail_uri: "http://localhost:3000/login/oauth/fail",
		facebook: {
			app_id: "12345",
			app_secret: "abcd123",
			scope: "email,user_about_me,user_friends",
			auth_uri: "https://www.facebook.com/dialog/oauth",
			token_uri: "https://graph.facebook.com/v2.3/oauth/access_token",
			api_uri: "https://graph.facebook.com/me?fields=id,name,about,age_range,bio,email,picture",
		},
		twitter: {
			app_id: "12345",
			app_secret: "abcd123",
			auth_uri: "https://api.twitter.com/oauth/authenticate",
			api_uri: "https://api.twitter.com/1.1/",
			token_uri: "https://api.twitter.com/oauth2/token"
		},
		google: {
			app_id: "12345",
			app_secret: "abcd123",
			auth_uri: "https://accounts.google.com/o/oauth2/auth",
			scope: "email+profile",
			api_uri: "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
			token_uri: "https://www.googleapis.com/oauth2/v3/token"
		},
		linkedin: {
			app_id: "12345",
			app_secret: "abcd123",
			auth_uri: "https://www.linkedin.com/uas/oauth2/authorization",
			scope: "r_basicprofile%20r_emailaddress",
			api_uri: "https://api.linkedin.com/v1/people/~:(id,num-connections,picture-url,email-address)?format=json",
			token_uri: "https://www.linkedin.com/uas/oauth2/accessToken",
			email_field: "emailAddress"
		}
	}
};