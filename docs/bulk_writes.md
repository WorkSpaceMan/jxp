# Bulk Writes

You can perform bulk writes through the `/bulkwrite/<modelname>` endpoint. **Disabled by default** for non-admin users unless the model opts in with `advanced_queries: { bulkwrite: true }`. **Admin users** may use bulk write on any model. Only allowlisted operations (`insertOne`, `updateOne`, `replaceOne`, `deleteOne`) are accepted; `updateMany` / `deleteMany` require admin.

Authorisation is checked **per operation** (admins bypass):

| Operation | Permissions required |
|-----------|---------------------|
| `insertOne` | create |
| `updateOne` / `replaceOne` | update; plus create when `upsert: true` |
| `deleteOne` | delete |
| `updateMany` / `deleteMany` | admin only (updateMany follows the same upsert rule for admins) |

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
