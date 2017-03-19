var expect = require("expect.js")
var Cache = require("../src/Cache")
var CacheDependency = require("../src/CacheDependency")

describe("Cache", function() {
    it("should remove extra items", function() {
        var cache = new Cache(3)
        cache.insert("one", 1)
        cache.insert("two", 2)
        cache.insert("three", 3)

        expect(cache.getCount()).to.be(3)
        expect(cache.get("one")).to.be(1)

        cache.insert("four", 4)

        expect(cache.getCount()).to.be(3)
        expect(cache.get("one")).to.be(undefined)
    })

    it("should remove items on dependency", function() {
        var cache = new Cache()
        cache.insert("one", 1)
        cache.insert("two", 2, { dependencies: new CacheDependency("one") })
        cache.remove("one")

        expect(cache.getCount()).to.be(0)

        cache.insert("one", 1)
        var dep = new CacheDependency("one")
        cache.insert("two", 2, { dependencies: dep })
        cache.insert("three", 3, { dependencies: new CacheDependency(undefined, dep) })
        cache.remove("one")

        expect(cache.getCount()).to.be(0)
    })
})
