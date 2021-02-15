# Special Features

## We allways encrypt passwords

You should note that if you send through anything called "password", it will automagically encrypt using bcrypt, unless you send the parameter `password_override=1`.

## Reflection/navel gazing

The endpoint `/model` shows us all available models.

The endpoint `/model/modelname` gives us a description of a model.

## Cache

The `/cache` endpoint should show us some info about the state of our Memcached server.

## Downloading data as CSV

If you replace `/api` with `/csv` on an endpoint, you will get the data in comma-separated text format. CSV supports filtering, ordering etc, but it does not support linking related documents.

## Soft deleting

Instead of deleting records from the database, we mark them as `_deleted: true`. In this case, the API will report them deleted if you try to GET them. If you need to see the deleted items, add `?showDeleted=true` to your url. If you want to undelete an item, PUT `_deleted: false` to the record.

## Permanently deleting

You can permanently delete a document by passing the parameter `?_permaDelete=1` to the endpoint.

## Cascade deleting

You can delete all of the rows that reference a row you're deleting by adding `?_cascade=1` to your endpoint.

You can combine permanent and cascade deleting.