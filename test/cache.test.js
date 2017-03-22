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

    it("should apply sliding expiration to items", function() {
        const cache = new Cache()
        cache.set("one", 1, { slidingExpirationMsec: 1000 })
        cache.set("two", 2, { slidingExpirationMsec: 1250 })

        return delayPromise(500)()
            .then(() => {
                expect(cache.has("one")).toBeTruthy()
                expect(cache.has("two")).toBeTruthy()

                cache.get("two") // trigger sliding expiration prolongation
            })
            .then(delayPromise(1000))
            .then(() => {
                expect(!cache.has("one")).toBeTruthy()
                expect(cache.has("two")).toBeTruthy()
            })
    })

    it("should apply absolute expiration to items", function() {
        const cache = new Cache()
        cache.set("one", 1, { absoluteExpiration: new Date(new Date().getTime() + 500) })
        cache.set("two", 2, { absoluteExpiration: new Date(new Date().getTime() + 1000) })

        return delayPromise(250)()
            .then(() => {
                expect(cache.has("one")).toBeTruthy()
                expect(cache.has("two")).toBeTruthy()

                cache.get("one")
            })
            .then(delayPromise(500))
            .then(() => {
                expect(!cache.has("one")).toBeTruthy()
                expect(cache.has("two")).toBeTruthy()
            })
    })

    it("snippet should work", function() {
        const cache = new Cache(3) // max size is three items
        const key = { id: "three", hello: "world" } // can be any plain object

        cache.set("one", 1)
        cache.set("two", { a: 1, b: { c: "hi" }})
        cache.set(key, 3, { dependencies: new CacheDependency("two") })
        cache.set("four", { slidingExpirationMsec: 5000 }) // will be removed in 5 sec if not accessed

        let __ = cache.get("one") // undefined (deleted because of size limit)
        __ = cache.get("two") // { a: 1, b: { c: "hi" }}
        __ = cache.get(key) // 3

        cache.remove("two") // will also remove dependent item referenced by "key"
    })
})

function delayPromise(duration) {
    return (...args) => new Promise(resolve => { setTimeout(() => { resolve(...args) }, duration) })
}
