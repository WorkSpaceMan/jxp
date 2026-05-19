# Configuration

JXP 4 uses **environment variables** and [dotenv](https://github.com/motdotla/dotenv). Copy [`.env.sample`](../.env.sample) to `.env` and adjust values.

_As of version 4, there is no `config` npm package and no `/config/*.json` hierarchy._

## MongoDB

Set a full connection string:

```
MONGO_CONNECTION_STRING=mongodb://127.0.0.1:27017/myapp
```

Or build from parts (common in Docker):

```
MONGODB_HOST=127.0.0.1
MONGODB_PORT=27017
MONGODB_NAME=myapp
MONGODB_USER=
MONGODB_PASSWORD=
MONGODB_AUTH_DB=admin
```

Optional driver options as JSON:

```
MONGO_OPTIONS={"maxPoolSize":50}
```

## Server

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port | `4001` |
| `API_URL` / `API_SERVER` | Public base URL | `http://localhost:{PORT}` |
| `MODEL_DIR` | Path to `*_model.js` files | `./dist/models` (sample server) |
| `LOG_FILE` | Access log path | `access.log` |
| `SHARED_SECRET` | JWT / recovery signing | — |
| `TOKEN_EXPIRY` | Access token TTL (seconds) | `86400` |
| `REFRESH_TOKEN_EXPIRY` | Refresh token TTL (seconds) | `2678400` |
| `APIKEY` | Internal API key for schema helpers | — |

## Cache

```
CACHE_ENABLED=true
CACHE_DEBUG=false
CACHE_TTL=300
```

When enabled, JXP uses an in-process cache ([node-cache](https://www.npmjs.com/package/node-cache)). GET responses may include `jxp-cache` (`hit` / `miss`) and `jxp-cache-key` headers. Admin endpoints (no auth required by default):

- `GET /cache/stats` — cache statistics, or `{ cache_enabled: false }` when disabled
- `GET /cache/clear` — flush all cached entries

See [Caching](caching.md) for details.

## Query limits

```
QUERY_LIMITS_ENABLED=true
QUERY_LIMITS_LARGE_COLLECTION_THRESHOLD=10000
QUERY_LIMITS_MAX=1000
```

## Throttling

Optional JSON blob:

```
THROTTLE_JSON={"burst":100,"rate":50,"ip":true}
```

## Model directory

JXP discovers models by scanning `MODEL_DIR` for `*_model.js`. You can also pass `model_dir` in the object given to `JXP(apiconfig)`.

Relative `model_dir` paths resolve from `process.cwd()` (typical for npm scripts), not from the server script path.

## Programmatic config

Apps typically build an options object and pass it to `JXP()`:

```javascript
const JXP = require("jxp");
const server = JXP({
  port: 4001,
  mongo: { connection_string: process.env.MONGO_CONNECTION_STRING },
  model_dir: "./models",
  pre_hooks: { get: (req, res, next) => next() },
});
```

The sample JXP server uses `loadJxpConfig()` from `jxp/libs/load-config` (resolved via `package.json` `exports` to compiled `dist/libs/load-config.js`) to build the same shape from `.env`.

### SMTP and password recovery

SMTP and password-recovery URLs are **not** read from environment variables by `loadJxpConfig()`. Pass them on the `JXP()` options object:

```javascript
JXP({
  smtp_server: "mail.example.com",
  smtp_username: "user",
  smtp_password: "secret",
  smtp_from: "noreply@example.com",
  password_recovery_url: "https://myapp.example.com/reset",
});
```

Used by `POST /login/recover` (see [Authentication](authentication.md)).

### OAuth

OAuth2 providers are configured programmatically on the `oauth` key:

```javascript
JXP({
  url: "http://localhost:4001",
  oauth: {
    success_uri: "https://myapp.example.com/oauth/success",
    fail_uri: "https://myapp.example.com/oauth/fail",
    google: {
      auth_uri: "https://accounts.google.com/o/oauth2/v2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      api_uri: "https://www.googleapis.com/oauth2/v2/userinfo",
      app_id: "...",
      app_secret: "...",
      scope: "email profile",
    },
  },
});
```

Routes: `GET /login/oauth/:provider` and `GET /login/oauth/callback/:provider`. See [Authentication](authentication.md).

## Tests

Tests load `.env.test` via `test/env.js` (see `npm test`). Set `NODE_ENV=test` and `MONGO_CONNECTION_STRING` for your local Mongo instance.
