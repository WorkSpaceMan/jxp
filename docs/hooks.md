# Hooks

In `/bin/server.js` you will find some pre-operation hooks. These will run after `auth` but before the operation. 

We've used callbacks to add parameters on `get` and `getOne` to our queries to limit what certain users see in the results. We've also use the `post`, `put` and `delete` to fire emits on an external Websocket server.

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
	delete: (req, res, next) => {
		next();
	},
};
```

For _login_ there's also a post-hook, eg. if you need to inject more information into the login result.

```javascript
config.post_hooks = (req, res, next) => {
	res.result.some_field = "Some Value";
	next();
}
```

To suppress a callback, pass `_silence=true` as a parameter. This helps avoid infinite loops, for instance when your PUT updates the same model.