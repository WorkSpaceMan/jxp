/* 
===============
API Engineroom 
===============
*/

/* 

This Express route supports CRUD operations without having to define controllers for each type. 

You do still have to define Mongoose models, which we expect to find at ../models.

Supports the following verbs:
- GET - Gets a list or a single object
- POST - Creates a single object
- PUT - Updates a single object
- DELETE - Deletes a single object

The format is /:modename for a GET list and a POST.
The format is /:modelname/:_id for a GET item, PUT and DELETE.

When GETting a list, you can add a Filter as a parameter, eg. /:modelname?filter[field]=value

To filter with $gte, $lte or similar, use a colon to divide the operator and query. Eg. /:modelname?filter[field]=$gte:value

There's also a special route, /:modelname/_describe, which returns the model

User model should look a bit like:

```
var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var UserSchema   = new Schema({
	name: String,
	email: String,
	password: String,
	apikey: String,
	admin: Boolean,
	temp_hash: String,
});

UserSchema.set("_perms", {
	admin: "rw",
	owner: "rw",
	user: "r"
});

module.exports = mongoose.model('User', UserSchema);
```

You can set permissions per model by setting _perms on the schema. Eg:
```
TestSchema.set("_perms", {
	admin: "rw",
	owner: "rw",
	user: "r",
	all: "r"
});
```

If you want to use the owner property, you need to have _owner_id in your model.
Eg. 
```
_owner_id: mongoose.Schema.Types.ObjectId;
```

Possible permission keys are:
"admin" | anyone with "admin" set to true 
"owner" | on a per-record basis, the person who originally wrote the record
"user"  | any registered user
"all"   | the w0rld

(See below for adding group permissions)

Possible values are:
"c"  | create
"r"  | read
"u"  | update
"d"  | delete

###Groups

To define groups, you need a usergroups model. It should look like this:

```
var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;
var Objectid = mongoose.Schema.Types.ObjectId;
var UserGroupSchema   = new Schema({
	user_id: Objectid,
	groups: [String],
	_date: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Usergroup', UserGroupSchema);
```

Note that it doesn't have a _perm section, because it is accessed directly,
not through the API. If you do want to access it through the API, feel free
to add a _perm section, but make sure you lock down permissions.

To set a user's groups, call the API as follows:
Type: POST 
End-point: /_groups/:user_id 
Data: { group: "group_name" }

To add a user to a group, call the API as follows:
Type: PUT 
End-point: /_groups/:user_id 
Data: { group: "group_name" }

* For POST and PUT, you can send multiple groups at once.

To remove a user from a group
TYPE: DELETE
End-point: /_groups/:user_id
Data: { group: "group_name" }

To check a user's groups:
Type: GET 
End-point: /_groups/:user_id 

Only Admins can use the /_groups endpoint.

To add permissions for a group to a model, just use the name, and give it permissions.
Eg:

```
TestSchema.set("_perms", {
	admin: "crud",
	no_delete: "cru",
	read_only: "r"
});
```

Admins would be able to do anything, users in the "no_delete" group would be able to create, read and update, and users in the read_only group would only be able to read.

Note that groups *do not fail* permissions, so if the user passes for admin, owner, or user, and not for group, the transaction will still go ahead.

###Soft Delete

If you want a model to soft delete, add a _deleted property as follows:

```
_deleted: { type: Boolean, default: false, index: true },
```

If _deleted equals true, the document will not show up when you get the list of 
documents, and calling it directly will result in a 404.

To show deleted documents when you get a list, add showDeleted=true to your query.

###Calling Static Methods

You can define a method for a Model in the model as follows:
```
TestSchema.statics.test = function() {
	return "Testing OKAY!";
}
```

Then to call that method through the API, use `https://my.api/api/_call/test`. 
If you POST, all variables will be passed through to the method.

###Adding custom permission logic

Maybe you want to do some more checks on permissions than the "crud" we offer. You can catch 
the user object in your model as a virtual attribute. (I suppose you could use a real Mixed attribute too.)

Eg.

```
var sender;

LedgerSchema.virtual("__user").set(function(usr) {
	sender = usr;
});
```

And then later, say in your pre- or post-save...

```
(!sender.admin)) {
	return next(new Error( "Verboten!"));
}
```
*/

var JExpress = require("../libs/jexpress");
var User = require('../models/user_model');
var APIKey = require('../models/apikey_model');
var config = require('../config');
var security = require("../libs/security");

config.callbacks = {
	post: function(modelname, item, user) {
		console.log("Post callback");
	},
	put: function(modelname, item, user) {
		console.log("Put callback");
	},
	delete: function(modelname, item, user, opts) {
		console.log("Delete callback");
	}
};

var server = new JExpress(config);

server.listen(config.port || 4001, function() {
	console.log('%s listening at %s', server.name, server.url);
});