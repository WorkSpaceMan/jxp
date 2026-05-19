# Roles and Permissions

## Access Control

You can set permissions on each model for user groups which you can define yourself. There are also a few special groups:

* `all` -- All users, whether they authenticate or not.
* `owner` -- The user who created an item. This requires the model to have a `_owner_id` property (added automatically by JXPSchema).
* `user` -- Any authenticated user.
* `admin` -- Any admin user.

Each group can have one, some or all of the following permissions:

* `c` -- Create -- the ability to create a new record (a POST operation)
* `r` -- Retrieve -- the ability to read a record or all records (a GET operation)
* `u` -- Update -- the ability to update an existing record (a PUT operation)
* `d` -- Delete -- the ability to delete an existing record (a DELETE operation)

The permissions are defined in the schema constructor options (preferred):

```js
const TestSchema = new JXPSchema({
    foo: String,
}, {
    perms: {
        admin: "crud",
        owner: "rud",
        user: "cr",
        all: "r",
    },
});
```

Alternatively, after creating the schema:

```js
TestSchema.set("_perms", {
    admin: "crud",
    owner: "rud",
    user: "cr",
    all: "r",
});
```

In this case, the admin and record owner have full permissions. (We don't need to set "create" for the owner, obvz.) An authenticated user can create and retrieve records. Everyone can read everything.

To make a model completely private, just don't set the perms.

## Groups

You can add and remove groups to a user with the `/groups/:user_id` endpoint. The group will be automatically created if it doesn't already exist.

* GET gets all the groups for the user
* PUT adds a group
* POST rewrites the user's groups
* DELETE deletes the matching group

The field needs to be named `group`. You can even have an array of groups, eg. `group[0]`, `group[1]` etc.

***Example***

Note that you'll need to authenticate as an admin through one of the methods described in [Authentication](authentication.md).

Set the user's group to `test`

```
curl -X POST -F "group=test" "http://localhost:4001/groups/5485bd62fbad8791660d2658"
```

Add the groups `test0` and `test1`

```
curl -X PUT -F "group[0]=test0" -F "group[1]=test1" "http://localhost:4001/groups/5485bd62fbad8791660d2658"
```

### Adding custom permission logic

Maybe you want to do more checks on permissions than the built-in `crud` strings. You can capture the user object in your model as a virtual attribute (JXP sets `__user` on documents during API operations):

```js
var sender;

LedgerSchema.virtual("__user").set(function(usr) {
    sender = usr;
});
```

And then later, say in your pre- or post-save:

```js
if (!sender.admin) {
    return next(new Error("Verboten!"));
}
```
