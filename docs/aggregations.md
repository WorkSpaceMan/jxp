# Aggregation Queries

You can apply an aggregation pipeline through the `/aggregate/<modelname>` endpoint. See [MongoDB's aggregation documentation](https://www.mongodb.com/docs/manual/aggregation/).

Only allowlisted stages are permitted (e.g. `$match`, `$group`, `$lookup`, `$project`, `$sort`, `$limit`). Stages such as `$out`, `$merge`, and `$function` require an admin user. Disable per model with `advanced_queries: { aggregate: false }`.

POST the pipeline as a **JSON array**, or wrap it in a `"query"` property. Both forms are accepted:

```json
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

```json
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

Because HTTP JSON cannot carry Mongo ObjectIds as native values, JXP accepts a limited Extended JSON-style wrapper and converts it before execution.

Recommended form:

```json
{
    "query": [
        {
            "$match": {
                "campaign_id": { "$oid": "5fd45d05f2b93af8d59588fb" }
            }
        }
    ]
}
```

`$in` of ObjectIds:

```json
{
    "query": [
        {
            "$match": {
                "_id": {
                    "$in": [
                        { "$oid": "5fd45d05f2b93af8d59588fb" },
                        { "$oid": "5fd45d05f2b93af8d59588fc" }
                    ]
                }
            }
        }
    ]
}
```

Backward compatibility: legacy string forms such as `"ObjectId(\"<your object id>\")"` are still accepted. Typed wrappers are clearer and avoid overloading ordinary strings.

Using a pipeline to add a field:

```json
{
    "query": [
        {
            "$addFields": {
                "campaign_id_obj": {
                    "$toObjectId": "5fd45d05f2b93af8d59588fb"
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

Because HTTP JSON cannot carry Date values as native objects, JXP also accepts a limited Extended JSON-style wrapper for dates.

Recommended form:

```json
{
    "query": [
        {
            "$match": {
                "timestamp": {
                    "$gte": { "$date": "2021-03-03T00:00:00.0Z" }
                }
            }
        }
    ]
}
```

Backward compatibility: legacy string forms such as `"new Date(\"<your date>\")"` are still accepted. As with ObjectIds, wrappers can be used as field values or as `$in` elements.

Using a pipeline to add a date field:

```json
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

```json
{
    "query": [
        {
            "$match": {
                "timestamp": {
                    "$gte": "relative_date(null, null, \"month\")"
                }
            }
        }
    ]
}
```

### AllowDiskUse

Aggregates can use a lot of memory. If you're unable to complete your query, try using the disk. To enable `allowDiskUse`, add `?allowDiskUse=true` as a query parameter to the calling URL.
