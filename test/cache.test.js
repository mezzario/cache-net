/// <reference path="../typings/tsd.d.ts" />
"use strict";
var expect = require("expect.js");
var cache_1 = require("../src/cache");
var cache_2 = require("../src/cache");
describe("Cache", function () {
    it("should remove extra items", function () {
        var cache = new cache_1.default(3);
        cache.insert("one", 1);
        cache.insert("two", 2);
        cache.insert("three", 3);
        expect(cache.getCount()).to.be(3);
        expect(cache.get("one")).to.be(1);
        cache.insert("four", 4);
        expect(cache.getCount()).to.be(3);
        expect(cache.get("one")).to.be(undefined);
    });
    it("should remove items on dependency", function () {
        var cache = new cache_1.default();
        cache.insert("one", 1);
        cache.insert("two", 2, { dependencies: new cache_2.CacheDependency("one") });
        cache.remove("one");
        expect(cache.getCount()).to.be(0);
        cache.insert("one", 1);
        var dep = new cache_2.CacheDependency("one");
        cache.insert("two", 2, { dependencies: dep });
        cache.insert("three", 3, { dependencies: new cache_2.CacheDependency(undefined, dep) });
        cache.remove("one");
        expect(cache.getCount()).to.be(0);
    });
});
//# sourceMappingURL=cache.test.js.map