# Queries

You can post complex queries through the `/query/<modelname>` endpoint, such as doing `$and` or `$or` queries, or regex expressions.

Wrap your MongoDB filter in a `"query"` object and POST it as JSON. URL query parameters for `GET /api/<model>` also work here: `limit`, `page`, `sort`, `populate`, `filter`, `autopopulate`, and `fields`. See [The Restful API](api.md) for those features.

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

Note: the top-level `search` query parameter does not apply to `/query` — express search conditions inside the posted `query` object instead.
