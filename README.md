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
import { Cache, CacheDependency } from "cache-net"

const cache = new Cache(3) // max size is three items
const key = { id: "three", hello: "world" } // can be any plain object

cache.set("one", 1)
cache.set("two", { a: 1, b: { c: "hi" }})
cache.set(key, 3, { dependencies: new CacheDependency("two") })
cache.set("four", { slidingExpirationMsec: 5000 }) // will be removed in 5 sec if not accessed

let value = cache.get("one") // undefined (deleted because of size limit)
value = cache.get("two") // { a: 1, b: { c: "hi" }}
value = cache.get(key) // 3

cache.remove("two") // will also remove dependent item referenced by "key"
```

### In browser
Please use [webpack](https://github.com/webpack/webpack) or [browserify](https://github.com/substack/node-browserify) to include in web applications.
