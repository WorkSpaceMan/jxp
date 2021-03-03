# Aggregation Queries

You can apply an aggregation pipeline through the `/aggregate/<modelname>` endpoint. See [MongoDB's aggregation documentation](https://docs.mongodb.com/manual/aggregation/).

POST the query as JSON, and wrap it with a "query" variable, like so:
```JSON
{
    "query": [
        {
            "$group": { 
                "_id": null,
                "count": { 
                    "$sum": 1 
                } 
            } 
        }
    ]
}
```

### Aggregations with ObjectIds

Because we can't define ObjectIds in our aggregate functions, we need to send the ObjectIds as strings and then convert them in the pipeline.

Eg.
```JSON
{
    "query": [
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
}
```

### Aggregations with dates

Since we can't send a "Date" object, we need to create the date inline. Unfortunately this is slower than using a Date object.

```JSON
{
    "query": [
        {
            "$addFields": {
                "sd": {
                    "$dateFromString": {
                        "dateString": "2021-03-03T00:00:00.0Z"
                    }
                }
            }
        },
        {
            "$match": {
                "$expr": {
                    "$gte": [
                        "$timestamp", "$sd"
                    ]
                }
            }
        }
    ]
}
```

### AllowDiskUse

***Tip*** Aggregates can use a lot of memory. If you're unable to complete your query, try using the disk. To enable allowDiskUse, add `?allowDiskUse=true` as a query parameter to the calling url.