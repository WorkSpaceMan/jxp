# Aggregation Queries

You can apply an aggregation pipeline through the `/aggregate/<modelname>` endpoint. See [MongoDB's aggregation documentation](https://docs.mongodb.com/manual/aggregation/).

POST the query as JSON, and wrap it with a "query" variable, like so *:
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

* Note that embedding in a "query" is no longer necessary

### Aggregations with ObjectIds

Because we can't define ObjectIds in our aggregate functions, we need to send the ObjectIds as strings and then convert them in the pipeline.

There are two ways of doing this. We can embed `"ObjectId(\"<your object id>\")"` or you can convert in the pipeline. Embedding will be faster on execution.

Embedding:
```JSON
{
    "query": [
        {
            "$match": {
                "$campaign_id", "ObjectId(\"5fd45d05f2b93af8d59588fb\")"
            }
        }
    ]
}
```

Using a pipeline to add a field:
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

Because we can't define Date objects in our aggregate functions, we need to send the dates as strings and then convert them in the pipeline.

There are two ways of doing this. We can embed `"new Date(\"<your date>\")"` or you can convert in the pipeline. Embedding will be faster on execution.

Embedding:
```JSON
{
    "query": [
        {
            "$match": {
                "$timestamp": {
                    "$gte": "new Date(\"2021-03-03T00:00:00.0Z\")"
                }
            }
        }
    ]
}
```

Using a pipeline to add a date field:
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

### Relative dates

Say you want to use a date relative to today's date, you can use `relative_date(offset, offset_unit, startof_unit, endof_unit)`, similar to the method of embedding in a string above. It will also take `null` as a value.

Eg. to get the beginning of this month:
```JSON
{
    "query": [
        {
            "$match": {
                "$timestamp": {
                    "$gte": "relative_date(null, null, \"month\")"
                }
            }
        }
    ]
}
```

### AllowDiskUse

***Tip*** Aggregates can use a lot of memory. If you're unable to complete your query, try using the disk. To enable allowDiskUse, add `?allowDiskUse=true` as a query parameter to the calling url.