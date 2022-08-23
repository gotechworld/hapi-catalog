# Requests

### Create new index / update mapping by type
```
{
"index": "categories-test",
"type": "test1",
"settings": {"analysis":{"analyzer":{"custom_search":{"type":"custom","tokenizer":"standard","filter":["lowercase","stop","kstem"]}}}},
"mapping": {"name":{"type":"keyword"},"id":{"type":"integer"},"parent_id":{"type":"integer"},"path":{"type":"keyword"},"position":{"type":"integer"},"level":{"type":"integer"},"children_count":{"type":"integer"},"url_key":{"type":"keyword"},"status":{"type":"integer"},"display_mode":{"type":"keyword"},"request_path":{"type":"keyword"},"thumbnail":{"type":"keyword"},"meta_description":{"type":"keyword"},"meta_title":{"type":"keyword"},"meta_keywords":{"type":"keyword"},"landing_page":{"type":"integer"}}
}
```

### Create new alias
```
{
  "index": "index_name",
  "alias": "alias_name"
}
```

### Bulk update products
PUT/POST /rest/products/bulk
```
{
  "data": [{
    "id": 667,
    "description": "Bulk update 667",
    "any_other_field": "new value"
  },
  {
    "id": 668,
    "description": "Bulk update 668!"
  }]
}
```

### Bulk delete products
DELETE /rest/products/bulk
```
{
  "data": [667, 668]
}
```

### Remove field
DELETE /rest/products/fields
```
{
  "fieldName": "description",
  "data": [667, 668]
}
```
