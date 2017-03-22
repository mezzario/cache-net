import expect from "expect"
import { Cache, CacheDependency } from "../src"

describe("Cache", function() {
    it("should remove extra items", function() {
        const cache = new Cache(3)
        cache.set("one", 1)
        cache.set("two", 2)
        cache.set("three", 3)

        expect(cache.size).toBe(3)
        expect(cache.get("one")).toBe(1)

        cache.set("four", 4)

        expect(cache.size).toBe(3)
        expect(cache.get("one")).toBe(undefined)
    })

    it("should remove items on dependency", function() {
        const cache = new Cache()
        cache.set("one", 1)
        cache.set("two", 2, { dependencies: new CacheDependency("one") })
        cache.remove("one")

        expect(cache.size).toBe(0)

        cache.set("one", 1)
        const dep = new CacheDependency("one")
        cache.set("two", 2, { dependencies: dep })
        cache.set("three", 3, { dependencies: new CacheDependency(undefined, dep) })
        cache.remove("one")

        expect(cache.size).toBe(0)
    })

    it("should enumerateand support compound keys", function() {
        const cache = new Cache()
        cache.set("three", 3)
        cache.set("one", 1)
        cache.set({ a: 15, b: "two" }, 2)

        const keys = []

        cache.enumerate(function(key/*, value, keyData*/) {
            keys.push(key)
        })

        expect(keys.length).toBe(3)
        expect(keys[0]).toBe("three")
        expect(keys[1]).toBe("one")
        expect(cache.get({ b: "two", a: 15 })).toBe(2)
    })

    it("should clear", function() {
        const cache = new Cache()
        cache.set("three", 3)
        cache.set("one", 1)
        cache.set("two", 2)

        cache.clear(function(key/*, value, keyData*/) {
            return key !== "two"
        })

        expect(cache.size).toBe(1)
        expect(cache.has("two")).toBeTruthy()
    })

    it("should adjust max size", function() {
        const cache = new Cache()
        cache.set("one", 1)
        cache.set("two", 2)
        cache.set("three", 3)
        cache.set({ four: true }, { hello: "world" })

        cache.maxSize = 2

        expect(cache.size).toBe(2)
        expect(cache.has("three")).toBeTruthy()
        expect(cache.has({ four: true })).toBeTruthy()
    })
})
