## RESTful API

The API lets us read, create, update and delete items. Generally, our `endpoint` (API-speak for URL) decides which collection or item we're referring to, and the HTTP `verb` describes whether we want to read (GET), create (POST), update (PUT) or delete (DELETE). Strict RESTful APIs also have PATCH and OPTIONS. JXP doesn't. A PUT is a PATCH. Deal with it.

### GET

We can either GET an entire collection, or an individual item. For an entire collection, we use the endpoint `/api/{modelname}`. For instance, GET `/api/test` would return all the test items. Please note that it will always return ALL the items. If you have a big collection, use the `limit` function because we don't do that for you.

For an individual item, we just add the `_id` to the endpoint, as in `/api/{modelname}/{_id}`. Eg. GET `/api/test/5731a48b7571ff6248bd6d9c`.

***Note that getting a single item returns just the item, without any meta data. This isn't great, but it's legacy.***

### Populating

This is one of the most useful features of this API. You can automatically populate the results with linked objects.

To autopopulate all the fields, use the parameter `autopopulate=1`

To populate just one field, use `populate=field`

### Limiting results

Add the parameter `limit=x` to limit the results by x. You'll see the results now include a page count and a link to the next page. You can then use `page=x` to page through the results.

### Filtering

Use `filter[fieldname]=blah` to filter.

You can also filter for greater than, less than, greater than or equals and less than or equals for stuff like dates and numbers.

`filter[start_date]=gte:12345678` (Pro tip: use Unix time to filter on dates.)

### Searching

This works like filtering, but it's a case-insensitive search:

`search[email]=jason`

### Full-text searching

You can perform a search against a full-text index by using `search`.

`search=Test`

To ensure a full-text index across all fields on your model, add this to your schema:

`MySchema.index( { "$**": "text" } );`

See [https://docs.mongodb.com/manual/core/index-text/](MongoDB Text Indexes) for more options, such as weighted indexing.

Note that you can only declare one index per collection (and hence schema).

### POST

POST always saves a new item, so the endpoint is always `/api/{modelname}`. For instance, POST `/api/test` would create a new test item.

### PUT

PUT updates an existing item, so the endpoint needs to include the _id, as in
`/api/{modelname}/{_id}`. Eg. PUT `/api/test/5731a48b7571ff6248bd6d9c`.

### DELETE

As with PUT, we need to reference a specific item, so the endpoint needs to include the _id, as in `/api/{modelname}/{_id}`. Eg. DELETE `/api/test/5731a48b7571ff6248bd6d9c`.

### An important note about Passwords

You should note that if you send through anything called "password", it will automagically encrypt using bcrypt, unless you send the parameter `password_override=1`.

### Reflection/navel gazing

The endpoint `/model` shows us all available models.

The endpoint `/model/modelname` gives us a description of a model.