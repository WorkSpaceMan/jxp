# Configuration

JXP 4 uses **environment variables** and [dotenv](https://github.com/motdotla/dotenv). Copy [`.env.sample`](../.env.sample) to `.env` and adjust values.

There is no `config` npm package and no `/config/*.json` hierarchy.

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

JXP discovers models by scanning `MODEL_DIR` for `*_model.js`. You can also pass `model_dir` in the object given to `JXP(apiconfig)` (as RevEngine does from its own `lib/env.js`).

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

The sample JXP server uses `loadJxpConfig()` from `jxp/libs/load-config` to build the same shape from `.env`.

## Tests

Tests load `.env.test` via `test/env.js` (see `npm test`). Set `NODE_ENV=test` and `MONGO_CONNECTION_STRING` for your local Mongo instance.
