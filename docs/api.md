# The Restful API

The API lets us read, create, update and delete items. Generally, our `endpoint` (API-speak for URL) decides which collection or item we're referring to, and the HTTP `verb` describes whether we want to read (GET), create (POST), update (PUT) or delete (DELETE). Strict RESTful APIs also have PATCH and OPTIONS. JXP doesn't. A PUT is a PATCH.

## Getting a document

To get a single document, we use the endpoint with the collection and document _id. Note that the `data` returns an object.

Request
```
GET /api/test/5eb7cf838c9fba641e0e9dcb
```

Response
```json
{
    "data": {
        "_deleted": false,
        "shmack": [
            "do",
            "ray",
            "me"
        ],
        "array_link_id": [],
        "_id": "5eb7cf838c9fba641e0e9dcb",
        "foo": "Foo1",
        "bar": "Bar",
        "yack": {
            "yack": "yack",
            "shmack": 1
        },
        "fulltext": "In Xanadu did Kubla Khan a stately pleasure dome decree",
        "_owner_id": "5eb7cf838c9fba641e0e9dc3",
        "createdAt": "2020-05-10T09:55:15.957Z",
        "updatedAt": "2020-05-10T09:55:16.144Z",
        "__v": 0,
        "link_id": "5eb7cf848c9fba641e0e9dcc",
        "other_link_id": "5eb7cf848c9fba641e0e9dcd",
        "id": "5eb7cf838c9fba641e0e9dcb"
    }
}
```

## Getting many documents

You can get all the documents from a collection by hitting the collection name endpoint. Note that the `data` returns an array.

Request
```
GET /api/test
```

Response
```
{
    "count": 1,
    "data": [
        {
            "_deleted": false,
            "shmack": [
            "do",
            "ray",
            "me"
            ],
            "array_link_id": [],
            "_id": "5eb7cf838c9fba641e0e9dcb",
            "foo": "Foo1",
            "bar": "Bar",
            "yack": {
            "yack": "yack",
            "shmack": 1
            },
            "password": "$2a$04$lhy1QmVrUc7gGF7TKPAGdePdGVw51YQRk1b9.JPxrlXR/IgPOyeSi",
            "fulltext": "In Xanadu did Kubla Khan a stately pleasure dome decree",
            "_owner_id": "5eb7cf838c9fba641e0e9dc3",
            "createdAt": "2020-05-10T09:55:15.957Z",
            "updatedAt": "2020-05-10T09:55:16.144Z",
            "__v": 0,
            "link_id": "5eb7cf848c9fba641e0e9dcc",
            "other_link_id": "5eb7cf848c9fba641e0e9dcd",
            "id": "5eb7cf838c9fba641e0e9dcb"
        }
    ]
}
```

### Limit and pagination

We can limit the number of records returned by adding `?limit=<number of records>`. When we add a limit, the response includes the `limit`, `page_count`, `page`, and `next`. 

You can paginate with the `page=<page number>` parameter. Page count starts at 1.

If you go beyond the total number of pages, you will get an empty `data` array.

#### Large collections (required limit)

For collections with at least **10,000** documents (by default), `GET /api/<model>`, `GET /csv/<model>`, and `POST /query/<model>` **require** a valid `?limit=` between 1 and the configured maximum (default **1000**). Requests without `?limit=`, or with `?limit=` above the maximum, return **400 Bad Request**.

Use `GET /count/<model>` for totals on large collections.

Configure globally when starting JXP:

```js
query_limits: {
  enabled: true,
  large_collection_threshold: 10000,
  max: 1000,
}
```

Override per model in schema options:

```js
const ReaderSchema = new JXPSchema({ ... }, {
  perms: { ... },
  query_limits: { large_collection_threshold: 5000, max: 500 },
});
```

*Note* If you have more than 100,000 items in your collection, `count` will return as -1, else doing a full-dataset filtered count becomes too expensive and can cause serious performance issues.

### Counting

To get a count of a collection, use the endpoint `/count/<model>`. This works even on large collections that wouldn't otherwise return a count due to size of over 100,000 items. Filters can be applied, but `search` does not work. 

Eg. 

```
GET /count/test
```

Response:
```
{
    count: 1
}
```

### Populating

This is one of the most useful features of this API. You can automatically populate the results with linked objects.

* To autopopulate all the linked objects, use the parameter `autopopulate=1`

* To populate just one linked object, use `populate=linked_object`

* To populate multiple linked objects, you can use `populate[]=linked_object1&populate[]=linked_object2`

* To populate and just return specific fields, use `populate[linked_object]=field1,field2`

### Filtering

Use `filter[fieldname]=blah` to filter.

You can also filter for greater than, less than, greater than or equals and less than or equals for stuff like dates and numbers.

`filter[start_date]=$gte:12345678` (Pro tip: use Unix time to filter on dates.)

You can also pass a Regex expression JXP will convert it to a real Regex for you: `filter[name]=$regex:/blah/i`.

### Searching

This works like filtering, but it's a case-insensitive search:

`search[email]=jason`

### Full-text searching

You can perform a search against a full-text index by using `search`.

`search=Test`

To ensure a full-text index across all fields on your model, add this to your schema:

`MySchema.index( { "$**": "text" } );`

See [MongoDB Text Indexes](https://www.mongodb.com/docs/manual/core/index-text/) for more options, such as weighted indexing.

Note that you can only declare one index per collection (and hence schema).

## Saving a new document

POST always saves a new item, so the endpoint is always `/api/{modelname}`. For instance, POST `/api/test` would create a new test item.

## Updating a document

PUT updates an existing item, so the endpoint needs to include the _id, as in
`/api/{modelname}/{_id}`. Eg. PUT `/api/test/5731a48b7571ff6248bd6d9c`.

## Deleting a document

As with PUT, we need to reference a specific item, so the endpoint needs to include the _id, as in `/api/{modelname}/{_id}`. Eg. DELETE `/api/test/5731a48b7571ff6248bd6d9c`. Note that we soft-delete documents. See [Special Features - Soft deleting](special.md#soft-deleting) for more info.

## Advanced queries

If you need to send an advanced query, such as a combined `$and`/`$or`, POST JSON to `/query/{modelname}` with a **`query` object** (required). Most URL features from `GET /api/{modelname}` still apply (`limit`, `page`, `sort`, `populate`, `filter`, `autopopulate`, `fields`) except `search`.

Eg.

```json
{
    "query": {
        "$and": [
            {
                "foo": {
                    "$regex": "foo",
                    "$options": "i"
                }
            },
            {
                "bar": "Bar"
            }
        ]
    }
}
```

See [Queries](queries.md) for more examples.

## Aggregate queries

You can perform an aggregate query by POSTing a pipeline array to `/aggregate/{modelname}`, or wrapping it in `{ "query": [ ... ] }`. See [Aggregations](aggregations.md).

Eg.
```javascript
[
    { 
        $match: { 
            $or: [ 
                { 
                    score: { 
                        $gt: 70, $lt: 90 
                    } 
                }, 
                { 
                    views: { 
                        $gte: 1000 
                    } 
                } 
            ] 
        } 
    },
    { 
        $group: { 
            _id: null, 
            count: { 
                $sum: 1 
            } 
        } 
    }
]
```