# Hooks

In your app's server bootstrap (eg. `dist/bin/server.js` compiled from `src/bin/server.ts`), configure `pre_hooks` and `post_hooks` on the object passed to `JXP()`. These run after authentication but before (or after, for post-hooks) the operation.

We've used pre-hooks on `get` and `getOne` to add query constraints so certain users only see allowed rows. We've also used `post`, `put`, and `delete` hooks alongside JXP's built-in WebSocket emitter to notify subscribed clients of changes.

```javascript
config.pre_hooks = {
	login: (req, res, next) => {
		next();
	},
	get: (req, res, next) => {
		next();
	},
	getOne: (req, res, next) => {
		next();
	},
	post: (req, res, next) => {
		next();
	},
	put: (req, res, next) => {
		next();
	},
	update: (req, res, next) => {
		next();
	},
	delete: (req, res, next) => {
		next();
	},
};
```

For _login_ there is also a post-hook if you need to inject more information into the login result:

```javascript
config.post_hooks = {
	login: (req, res) => {
		res.result.some_field = "Some Value";
	},
};
```

To suppress model callbacks (eg. to avoid infinite loops when a PUT updates the same model), pass `_silence=true` as a query parameter or in the request body.
