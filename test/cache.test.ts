/// <reference path="../typings/tsd.d.ts" />

import expect = require("expect.js");
import Cache from "../src/cache";
import { CacheDependency } from "../src/cache";

describe("Cache", () => {
    it("should remove extra items", () => {
        let cache = new Cache(3);
        cache.insert("one", 1);
        cache.insert("two", 2);
        cache.insert("three", 3);

        expect(cache.getCount()).to.be(3);
        expect(cache.get("one")).to.be(1);

        cache.insert("four", 4);

        expect(cache.getCount()).to.be(3);
        expect(cache.get("one")).to.be(undefined);
    });

    it("should remove items on dependency", () => {
        let cache = new Cache();
        cache.insert("one", 1);
        cache.insert("two", 2, { dependencies: new CacheDependency("one") });
        cache.remove("one");

        expect(cache.getCount()).to.be(0);

        cache.insert("one", 1);
        let dep = new CacheDependency("one");
        cache.insert("two", 2, { dependencies: dep });
        cache.insert("three", 3, { dependencies: new CacheDependency(undefined, dep) });
        cache.remove("one");

        expect(cache.getCount()).to.be(0);
    });
});
