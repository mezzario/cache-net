# cache-net
### Features
* Size limit: delete old items if full.
* Expiration: absolute or sliding.
* String or Object keys for stored data.
* "Item Removed" event with text reason.
* Dependencies between items (cascading remove):
  - defined by cache key;
  - defined by other dependency.

### Install
`npm i cache-net -S`

### Example
```javascript
var Cache = require("cache-net").default;
var CacheDependency = require("cache-net").CacheDependency;

var cache = new Cache(3); // max size is three items
var key = { id: "three", hash: 28374823 }; // can be any plain object

cache.insert("one", 1);
cache.insert("two", { a: 1, b: { c: "hi" }});
cache.insert(key, 3, { dependencies: new CacheDependency("two") });
cache.insert("four", { slidingExpirationMsec: 5000 }); // will be removed in 5 sec

var value = cache.get("one"); // undefined (deleted because of size limit)
value = cache.get("two"); // { a: 1, b: { c: "hi" }}
value = cache.get(key); // 3

cache.remove("two"); // will also remove dependent item referenced by "key"
```
