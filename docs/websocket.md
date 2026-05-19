# Websockets

JXP exposes a WebSocket server on the same HTTP port as the REST API (upgrade on the shared Restify server). Clients receive real-time notifications when documents are created, updated, or deleted, subject to the same permission checks as the REST API.

## Connecting

Connect to the WebSocket URL for your server (same host and port as the API, `ws://` or `wss://` scheme).

## Message format

Send JSON messages with:

| Field | Description |
|-------|-------------|
| `action` | One of `ping`, `auth`, `subscribe`, `unsubscribe` |
| `msg_id` | Client-chosen id echoed in the response (required) |
| `data` | Action-specific payload (optional object) |

Responses include `status` (`okay` or `error`), `msg_id`, `client_id`, and optionally `result` or `message`.

### ping

Request:

```json
{ "action": "ping", "msg_id": "1", "data": {} }
```

Response `result`: `"pong!"`

### auth

Authenticate before subscribing. Provide one of:

- `data.email` and `data.password`
- `data.apikey`
- `data.token` (Bearer access token)

Request:

```json
{
  "action": "auth",
  "msg_id": "2",
  "data": { "email": "user@example.com", "password": "secret" }
}
```

### subscribe

Subscribe to changes on a model. Requires prior `auth`.

**Collection-wide** (post, put, delete on any document):

```json
{
  "action": "subscribe",
  "msg_id": "3",
  "data": { "model": "test" }
}
```

**Single document** (put and delete on one id):

```json
{
  "action": "subscribe",
  "msg_id": "4",
  "data": { "model": "test", "id": "5eb7cf838c9fba641e0e9dcb" }
}
```

Optional `data.filter` limits which events are delivered (field values must match on the changed document).

### unsubscribe

Same `data` shape as `subscribe` (`model`, optional `id`).

## Events pushed to the client

When a subscribed change occurs, the server sends JSON with a `data` object such as:

```json
{
  "client_id": "<ws client id>",
  "data": {
    "event": "put",
    "modelname": "test",
    "item": { ... },
    "user_id": "...",
    "user_name": "...",
    "user_email": "..."
  }
}
```

`event` is one of `post`, `put`, or `del`.

## Hooks

Server `pre_hooks` on `post`, `put`, and `delete` run in the same process as the WebSocket emitter. Use hooks to enforce extra rules; subscribers only receive events the acting user was allowed to perform.
