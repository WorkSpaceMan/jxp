# Advanced Features

## Queries

You can post complex queries through the `/query/<modelname>` endpoint, such as doing `$and` or `$or` queries, or regex expressions.

Eg.

```JSON
    {
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
```

## Aggregations

You can apply an aggregation pipeline through the `/aggregate/<modelname>` endpoint. See [MongoDB's aggregation documentation](https://docs.mongodb.com/manual/aggregation/).

Eg:
```JSON
[
    {
        "$group": { 
            "_id": null,
            "count": { 
                "$sum": 1 
            } 
        } 
    }
]
```

### Aggregations with ObjectIds

Because we can't define ObjectIds in our aggregate functions, we need to send the ObjectIds as strings and then convert them in the pipeline.

Eg.
```JSON
[
    { 
        "$addFields": {
            "campaign_id_obj": {
                "$toObjectId":  "5fd45d05f2b93af8d59588fb"
            }
        }
    },
    {
        "$match": {
            "$expr": {
                "$eq": [
                    "$campaign_id", "$campaign_id_obj"
                ]
            }
        }
    }
]
```

### AllowDiskUse

To enable allowDiskUse, add `?allowDiskUse=true` as a query parameter to the calling url.

## Bulk Writes

You can bulk writes through the `/bulkwrite/<modelname>` endpoint. Note that authorisation works a little differently - the user must have permissions to Create, Edit, Update and Read.

***WARNING*** Be cautious when using bulk writes because you can destroy your data. Don't forget to back up!

Eg:
```JSON
[
    {
        "insertOne": {
            "document": {
                "foo": "Foo2",
                "bar": "Bar2",
                "yack": { "yack": "yack2", "shmack": 2 },
            }
        },
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
                "yack": { "yack": "yack3", "shmack": 3 },
            },
            "upsert": true
        },
    }
];
```