# Bulk Writes

You can perform bulk writes through the `/bulkwrite/<modelname>` endpoint. Note that authorisation works a little differently — the user must have **create, read, update, and delete** permissions on the model.

***WARNING*** Be cautious when using bulk writes because you can destroy your data. Don't forget to back up!

Eg:

```json
[
    {
        "insertOne": {
            "document": {
                "foo": "Foo2",
                "bar": "Bar2",
                "yack": { "yack": "yack2", "shmack": 2 }
            }
        }
    },
    {
        "updateOne": {
            "filter": {
                "foo": "Foo1"
            },
            "update": {
                "$set": {
                    "foo": "Foo bulk updated"
                }
            }
        }
    },
    {
        "updateOne": {
            "filter": {
                "foo": "Foo3"
            },
            "update": {
                "foo": "Foo3",
                "bar": "Bar3",
                "yack": { "yack": "yack3", "shmack": 3 }
            },
            "upsert": true
        }
    }
]
```
