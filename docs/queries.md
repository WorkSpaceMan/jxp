# Queries

You can post complex queries through the `/query/<modelname>` endpoint, such as doing `$and` or `$or` queries, or regex expressions.

Wrap it all in a "query" variable and POST it as JSON.

Eg.

```JSON
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