# Authentication

## API Key

There are four ways of authenticating:

* Basic Auth
* A Bearer Token
* An API Key
* A Javascript Web Token

We always use `email` and `password` to identify the user. The passwords are always one-way encrypted using bcrypt.

In a typical application, your front-end site would present a login page asking for the user's email and password. In addition, you would present a "Forgotten Password" link. 

When the user submits their username and password, you would POST that data to the `/login` endpoint. If the login succeeds, the page will return their API key and bearer token. 

## Login endpoints

### Login

Logging in will always delete the previous token and give you a new one.

POST `http://localhost:4001/login`
Data:
```json
{
    "email": "blah@blah.com",
    "password": "TopSecret"
}
```

Successful Response (Status 200):
```json
{
    "user_id": "5dadbd7e2384ad419975e4a1",
    "apikey": "<apikey>",
    "token": "<token>",
    "token_expires": "2025-11-21T21:26:20.671Z",
    "refresh_token": "<refresh_token>",
    "refresh_token_expires": "2025-12-21T21:26:20.671Z"
}
```

Failed Response (Status 401):
```json
{
    "status": "fail",
    "message": "Authentication failed",
    "err": "Incorrect email; email: <email>"
}
```

### Refresh Token

You can use your refresh_token to refresh a token, even if it's expired. By default, refresh tokens last 30 days, whereas tokens last 24 hours.

Note that the response is almost identical to the `/login` endpoint, except it doesn't have the `apikey`.

POST `http://localhost:4001/refresh`
Header: 
```json
{
    "Authorization": "Bearer <refresh token>",
}
```

Successful Response (Status 200):
```json
{
    "user_id": "5dadbd7e2384ad419975e4a1",
    "token": "<token>",
    "token_expires": "2025-11-21T21:26:20.671Z",
    "refresh_token": "<refresh_token>",
    "refresh_token_expires": "2025-12-21T21:26:20.671Z"
}
```

Failed Response (Status 401):
```json
{
    "status": "fail",
    "message": "Authentication failed",
    "err": "Incorrect email; email: <email>"
}
```

### Logout

This will immeditately expire the token.

POST or GET `http://localhost:4001/login/logout`

### Recover Password

Send the user an email with their JWT embedded so that they can reset their password

POST `http://localhost:4001/login/recover`

Data:
```
{
    "email": "blah@blah.com"
}
```

Successful Response (200): 
```
{
    "status": "ok",
    "message": "Sent recovery email"
}
```

Failed Response (403):
```
{
    "status": "fail",
    "message": "Unauthorized",
    "err": "Could not find email"
}
```

***Note:*** You will still have to build the password reset page on your front end.

### JWT

A Javascript Web Token can be used to log the user in through a URL. 

POST `http://localhost:4001/login/getjwt`

Data:
```
{
    "email": "blah@blah.com"
}
```

Successful Response (200): 
```
{
    "status": "ok",
    "jwt": "<jwt>"
}
```

Failed Response (403):
```
{
    "status": "fail",
    "message": "Unauthorized",
    "err": "Could not find email"
}
```

## Authenticating

### Basic Auth

Basic auth encodes (NOTE: ***NOT*** encrypts) your username and password and sends it as part of the header. You can use Basic Auth to authenticate yourself at any time.

***WARNING:*** You must only use basic auth over SSL, since it is trivial to decode the username and password. In fact, you should use SSL for everything, anyway.

A basic auth is created by base64-encoding your username and password, separated by a colon. 

Eg. `echo "blah@blah.com:password" | base64` would generate a basic auth token on the command line. (In this case, it would encode to `YmxhaEBibGFoLmNvbTpwYXNzd29yZAo=`.)

However, `echo "YmxhaEBibGFoLmNvbTpwYXNzd29yZAo=" | base64 --decode` would reveal the uesrname and password, which is why it's not safe to use it on an unencrypted connection.

Header: `Authorization: Basic <your basic token>`

### Bearer Token

_This is the preferred method of authenticating._

Bearer tokens are ephemeral tokens that will expire in a certain time period. When a user logs out of a session, they will be destroyed.

Header: `Authorization: Bearer <your bearer token>`

### API Key

The API Key is a permanent key that doesn't expire. It can be used by adding `?apikey=<apikey>` to the end of any request, or sending `apikey: <apikey>` in the header. 

