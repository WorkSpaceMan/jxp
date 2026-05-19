# Authentication

There are four ways of authenticating:

* Basic Auth
* A Bearer Token
* An API Key
* A Javascript Web Token (JWT)

We always use `email` and `password` to identify the user. Passwords are one-way encrypted using bcrypt.

In a typical application, your front-end site would present a login page asking for the user's email and password. In addition, you would present a "Forgotten Password" link.

When the user submits their username and password, you would POST that data to the `/login` endpoint. If the login succeeds, the response includes their API key and bearer token.

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

You can use your refresh_token to refresh a token, even if it's expired. By default, refresh tokens last 30 days, whereas tokens last 24 hours (configurable via `REFRESH_TOKEN_EXPIRY` and `TOKEN_EXPIRY`).

Note that the response is almost identical to the `/login` endpoint, except it doesn't have the `apikey`.

POST `http://localhost:4001/refresh`

Header:

```json
{
    "Authorization": "Bearer <refresh token>"
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

This will immediately expire the token. You must be authenticated (Bearer token or other method).

GET `http://localhost:4001/login/logout`

GET `http://localhost:4001/logout`

Successful Response (200):

```json
{
    "status": "ok",
    "message": "User logged out"
}
```

### Recover Password

Send the user an email with a JWT embedded so that they can reset their password. Requires SMTP settings on the `JXP()` config object (see [Configuration](configuration.md#smtp-and-password-recovery)).

POST `http://localhost:4001/login/recover`

Data:

```json
{
    "email": "blah@blah.com"
}
```

Successful Response (200):

```json
{
    "status": "ok",
    "message": "Sent recovery email"
}
```

Failed responses include 400 (missing email), 404 (user not found), or 401/500 depending on configuration errors.

***Note:*** You will still have to build the password reset page on your front end. The recovery link uses `password_recovery_url` from config plus the JWT token.

### JWT

A Javascript Web Token can be used to log the user in through a URL.

POST `http://localhost:4001/login/getjwt`

Data:

```json
{
    "email": "blah@blah.com"
}
```

Successful Response (200):

```json
{
    "status": "ok",
    "jwt": "<jwt>"
}
```

Failed Response (403 or 404):

```json
{
    "status": "fail",
    "message": "Unauthorized",
    "err": "Could not find email"
}
```

### OAuth2

OAuth login is configured programmatically (see [Configuration](configuration.md#oauth)).

- `GET /login/oauth/:provider` — redirects to the provider's authorization URL
- `GET /login/oauth/callback/:provider` — handles the callback and redirects to `oauth.success_uri` or `oauth.fail_uri` with a token or error

The provider name (`:provider`) must match a key under `oauth` in your config (excluding `success_uri` and `fail_uri`).

## Authenticating API requests

### Basic Auth

Basic auth encodes (NOTE: ***NOT*** encrypts) your username and password and sends it as part of the header. You can use Basic Auth to authenticate yourself at any time.

***WARNING:*** You must only use basic auth over SSL, since it is trivial to decode the username and password. In fact, you should use SSL for everything, anyway.

A basic auth token is created by base64-encoding your username and password, separated by a colon.

Eg. `echo -n "blah@blah.com:password" | base64` would generate a basic auth token on the command line.

However, `echo "YmxhaEBibGFoLmNvbTpwYXNzd29yZA==" | base64 --decode` would reveal the username and password, which is why it's not safe to use it on an unencrypted connection.

Header: `Authorization: Basic <your basic token>`

### Bearer Token

_This is the preferred method of authenticating._

Bearer tokens are ephemeral tokens that will expire after a configured period. When a user logs out of a session, they are revoked.

Header: `Authorization: Bearer <your bearer token>`

### API Key

The API Key is a permanent key that doesn't expire. It can be used by adding `?apikey=<apikey>` to the end of any request, or sending `x-api-key: <apikey>` in the header.
