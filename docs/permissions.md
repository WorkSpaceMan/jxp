# Roles and Permissions

## Access Control

You can set permissions on each model for user groups which you can define yourself. There are also a few special groups:
* `all` -- All users, whether they authenticate or not.
* `owner` -- The user who created an item. This requires the model to have a `_owner_id` property (see the above example).
* `user` -- Any authenticated user.
* `admin` -- Any admin user.

Each group can have one, some or all of the following permissions:
* `c` -- Create -- the ability to create a new record (a POST operation)
* `r` -- Retrieve -- the ability to read a record or all records (a GET operation)
* `u` -- Update -- the ability to update an existing record (a PUT operation)
* `d` -- Delete -- the ability to delete an existin record (a DELETE operation)

The permissions are defined in the model as follows:

```js
TestSchema.set("_perms", {
    admin: "crud", // CRUD = Create, Retrieve, Update and Delete
    owner: "rud",
    user: "cr",
    all: "r" // Unauthenticated users will be able to read from test, but that is all
});
```

In this case, the admin and record owner have full permissions. (We don't need to set "create" for the owner, obvz.) An authenticated user can create and retrive records. Everyone can read everything.

To make a model completely private, just don't set the perms.

## Groups

You can add and remove groups to a user with the `/groups/:user_id` endpoint. The group will be automatically created if it doesn't already exist.

* GET gets all the groups for the user
* PUT adds a group
* POST rewrites the user's groups
* DELETE deletes the matching group  

The field needs to be named `group`. You can even have an array of groups, eg. `group[0]`, `group[1]` etc.

***Example***

Note that you'll need to authenticate as an admin through one of the methods described for these examples

Set the user's group to `test`

```
curl -X POST -F "group=test" "http://localhost:3001/groups/5485bd62fbad8791660d2658"
```

Add the groups `test1` and `test2`

```
curl -X PUT -F "group[0]=test0" -F "group[1]=test1" "http://localhost:3001/groups/5485bd62fbad8791660d2658"
```

### Adding custom permission logic

Maybe you want to do some more checks on permissions than the "crud" we offer. You can catch
the user object in your model as a virtual attribute. (I suppose you could use a real Mixed attribute too.)

Eg.

```js
var sender;

LedgerSchema.virtual("__user").set(function(usr) {
    sender = usr;
});
```

And then later, say in your pre- or post-save...

```js
(!sender.admin)) {
    return next(new Error( "Verboten!"));
}
```