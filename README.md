# cache-net
A tiny JavaScript cache library inspired by .NET

### Features
* Size limit: delete old items if full.
* Expiration: absolute or sliding.
* String or Object keys for stored data.
* "Item Removed" event with text reason.
* Dependencies between items (cascading remove):
  - Defined by cache key.
  - Defined by other dependency.

### Install

`yarn add cache-net`

or

`npm i cache-net -S`

### Example
```javascript
var CacheNet = require("cache-net")
var Cache = CacheNet.Cache
var CacheDependency = CacheNet.CacheDependency

var cache = new Cache(3) // max size is three items
var key = { id: "three", hash: 28374823 } // can be any plain object

cache.insert("one", 1)
cache.insert("two", { a: 1, b: { c: "hi" }})
cache.insert(key, 3, { dependencies: new CacheDependency("two") })
cache.insert("four", { slidingExpirationMsec: 5000 }) // will be removed in 5 sec if not accessed

var value = cache.get("one") // undefined (deleted because of size limit)
value = cache.get("two") // { a: 1, b: { c: "hi" }}
value = cache.get(key) // 3

cache.remove("two") // will also remove dependent item referenced by "key"
```

### In browser
Please use [webpack](https://github.com/webpack/webpack) or [browserify](https://github.com/substack/node-browserify) to include in web applications.
