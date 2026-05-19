# Special Features

## We always encrypt passwords

If you send anything called `password`, it is encrypted with bcrypt automatically. The query parameter `password_override=1` skips hashing but **requires an admin user** (for setting a pre-computed hash).

## Reflection/navel gazing

The endpoint `/model` shows us all available models.

The endpoint `/model/modelname` gives us a description of a model.

## Cache

When caching is enabled, `GET /cache/stats` returns in-process cache statistics (see [Caching](caching.md)). Use `GET /cache/clear` to flush the cache.

## Downloading data as CSV

If you replace `/api` with `/csv` on an endpoint, you will get the data in comma-separated text format. CSV supports filtering, ordering etc, but it does not support linking related documents.

## Soft deleting

Instead of deleting records from the database, we mark them as `_deleted: true`. In this case, the API will report them deleted if you try to GET them. If you need to see the deleted items, add `?showDeleted=true` to your url. If you want to undelete an item, PUT `_deleted: false` to the record.

## Permanently deleting

You can permanently delete a document by passing the parameter `?_permaDelete=1` to the endpoint.

## Cascade deleting

You can delete all of the rows that reference a row you're deleting by adding `?_cascade=1` to your endpoint.

You can combine permanent and cascade deleting.
