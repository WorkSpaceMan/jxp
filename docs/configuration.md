# Configuring JXP

## Connecting to MongoDB

JXP uses MongoDB for storage. You can use a local MongoDB instance, or a hosted one such as Mongo Atlas.

The configuration for the MongoDB connection is set as environmental variables (for instance, if running in Docker), or in the `.env` file. Alternatively, you can set the connection string in the config file as described below, although this is not recommended.

```
MONGODB_HOST=127.0.0.1
MONGODB_PORT=27017
MONGODB_NAME=jxp
MONGODB_AUTH_DB=admin
MONGODB_USER=user
MONGODB_PASS=pass
```

## Config files

The config files are stored in `/config` in strict JSON format. (Remember to enclose your keys in inverted commas!) Typically, you'd use `/config/default.json` for a simple configuration, or `/config/development.json` and `/config/production.json` for separating development and production. 

If you used the `jxp-setup` command for setting everything up, you should have a basic `/config/default.json` file ready to go.

JXP uses [config](https://www.npmjs.com/package/config) for configuration. This allows you to have different configuration files for development, staging and production, set config variables through [environmental variables](https://github.com/lorenwest/node-config/wiki/Environment-Variables) or [command line overrides](https://github.com/lorenwest/node-config/wiki/Command-Line-Overrides), and do lots of other cool config magic. 

## Port

The `port` key defines the port you want the server to run on. The default is `4001`.
```json
"port": 4001,
```

## Model Directory

JXP will search for a model directory with "user_model.js" in it, else you can override this with the config parameter `model_dir`. (This should be an absolute directory.)

## MongoDB

The `connection_string` can include port, username and password, options, and other fancy stuff. If you have advanced needs, you can find out more (here)[https://docs.mongodb.com/manual/reference/connection-string/].

If you use Atlas, it will give you a connection string that you can use as-is.

The `options` allow you to pass extra options such as `poolSize`, `useNewUrlParser`, `useCreateIndex`, and `authSource`, amongst others. We use Mongoose's connection, so you can find out about the connection options (here)[https://mongoosejs.com/docs/connections.html]. Typically we only use `poolSize` and `authSource` in production, and no options in development.

A simple, local connection:
```json
"mongo": {
    "connection_string": "mongodb://localhost/test",
    "options": {}
},
```

A Mongo Atlas connection:
```json
"mongo": {
    "connection_string": "mongodb+srv://admin:<your password>@<your server>.gcp.mongodb.net/<your database>?retryWrites=true&w=majority",
    "options": {
            "readPreference": "nearest",
            "poolSize": 20,
            "authSource": "admin"
    }
},
```

## Token lifespans

Set how long you want your users' tokens to live for. Defaults to 24 hours for a token and 30 days for a refresh token.

```json
"token_expiry": 86400,
"refresh_token_expiry": 2678400
```

## Log

You can define an access log as follows:
```json
"log": "/var/log/openmembers/access.log",
```

## Memcached

Memcached is entirely optional. Leave it out completely to not use Memcached.

```json
"memcached": {
    "server": "localhost:11211",
    "lifetime": 604800
},
```

## Throttling

You can throttle the API performance. In the following example, we offer 5 requests per second, 10 concurrent requests, throttle by IP, and allow clients from 192.168.1.1 to go crazy.
```json
"throttle": {
    "burst": 10,
    "rate": 5,
    "ip": true,
    "overrides": {
        "192.168.1.1": {
            "rate": 0,
            "burst": 0
        }
    }
}
```

## Password recovery setup

We have a secret that we share with the front end in order to create Javascript Web Tokens as a login option. This would allow you to send a link to a client that would auto-log them in. We also use it for password recovery links. If you used `jxp-setup` it would have generated a random one for you.

We also configure a recovery url, which is a front-end page you'll want to hit, such as a password reset page.

We configure an SMTP connection to send out forgotten password links. 

```json
"shared_secret": "SomeRandomString",
"password_recovery_url": "https://blah.com/login/reset",
"smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "auth": {
            "user": "blah@blah.com",
            "pass": "blah"
    },
    "secureConnection": true
},
```

## oAuth

If you want users to be able to log in with an oAuth 2 provider, such as Google or Facebook, you would set it up as follows.

We have a `success_uri` and `fail_uri` that will direct the user to your front end's success and failure page, respectively.

Then, for each service you'd like to support, define the `app_id`, `app_secret`, `scope`, `auth_uri`, `token_uri` and `api_uri`.

Here are some examples. We used to support LinkedIn but they made some weird decisions that effectively broke their oAuth2 support. 

```
"oauth": {
    "success_uri": "https://my.workshop17.co.za/login/oauth",
    "fail_uri": "https://my.workshop17.co.za/login/oauth/fail",
    "facebook": {
        "app_id": "<your app id>",
        "app_secret": "<your app secret>",
        "scope": "email",
        "auth_uri": "https://www.facebook.com/dialog/oauth",
        "token_uri": "https://graph.facebook.com/v2.3/oauth/access_token",
        "api_uri": "https://graph.facebook.com/me?fields=id,name,about,age_range,email,picture"
    },
    "google": {
        "app_id": "<your app id>",
        "app_secret": "<your app secret>",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "scope": "email+profile",
        "api_uri": "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
        "token_uri": "https://www.googleapis.com/oauth2/v3/token"
    }
},
```