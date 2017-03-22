import * as RedBlackTree from "redblack"
import { Signal } from "signals"
import CacheDependency from "./CacheDependency"
import * as Utils from "./Utils"

export default class Cache {
    constructor(maxSize) {
        this.maxSize = maxSize
        this.itemRemoved = new Signal()

        this._map = Object.create(null)
        this._tree = RedBlackTree.tree()
        this._size = 0
        this._lastOrder = 1
    }

    get maxSize() {
        return this._maxSize
    }

    set maxSize(maxSize) {
        if (maxSize != null && maxSize <= 0)
            throw new Error("'maxSize' shoud be greater than 0")

        this._maxSize = maxSize

        if (maxSize != null)
            while (this._size > maxSize)
                this._removeItem(this._getOldestItem(), "Underused")
    }

    get size() {
        return this._size
    }

    set(key, value, options) {
        options = options || {}

        if (value === void 0)
            throw new Error("'value' cannot be undefined")

        const deps = options.dependencies
            ? (Array.isArray(options.dependencies)
                ? options.dependencies
                : [options.dependencies])
            : []

        for (let i = 0; i < deps.length; i++)
            if (!(deps[i] instanceof CacheDependency))
                throw new Error("'dependencies' should be one or more 'CacheDependency' instances")

        const absoluteExpiration = typeof options.absoluteExpiration === "function"
            ? options.absoluteExpiration.call(options)
            : options.absoluteExpiration

        if (absoluteExpiration != null && !(absoluteExpiration instanceof Date))
            throw new Error("'absoluteExpiration' is not a Date")

        if (options.slidingExpirationMsec != null) {
            if (absoluteExpiration != null)
                throw new Error("'slidingExpirationMsec' cannot be set if 'absoluteExpiration' is set")

            if ((options.slidingExpirationMsec < 0 || options.slidingExpirationMsec > 31536000000))
                throw new Error("allowed range for 'slidingExpirationMsec' is [0..31536000000] (up to one year)")
        }

        const keyStruct = Utils.getKeyStruct(key)
        const prevItem = this._map[keyStruct.keyStr]

        if (prevItem)
            this._removeItem(prevItem, "Overwritten")

        const item = {
            order: this._lastOrder++,
            key,
            keyStr: keyStruct.keyStr,
            keyData: keyStruct.keyData,
            value,
            absoluteExpiration,
            slidingExpirationMsec: options.slidingExpirationMsec,
            removeCallback: options.removeCallback
        }

        this._updateExpiration(item)

        if (this._maxSize != null && this._maxSize === this.size)
            this._removeItem(this._getOldestItem(), "Underused")

        this._map[item.keyStr] = item
        this._tree.insert(item.order, item)

        if (!prevItem)
            this._size++

        const depTriggered = () => {
            for (let i = 0; i < deps.length; i++)
                deps[i].triggered.remove(depTriggered)

            this.remove(key, "DependencyTriggered")
        }

        for (let i = 0; i < deps.length; i++) {
            const dependency = deps[i]

            dependency._attach(this)
            dependency.triggered.addOnce(depTriggered)
        }
    }

    get(key) {
        const keyStruct = Utils.getKeyStruct(key)
        const item = this._map[keyStruct.keyStr]

        if (item !== void 0) {
            this._updateExpiration(item)
            return item.value
        }
    }

    has(key) {
        const keyStruct = Utils.getKeyStruct(key)
        return this._map[keyStruct.keyStr] !== void 0
    }

    remove(key, reason) {
        const keys = Array.isArray(key) ? key : [key]

        for (let i = 0; i < keys.length; i++) {
            const keyStruct = Utils.getKeyStruct(keys[i])
            const item = this._map[keyStruct.keyStr]

            if (item)
                this._removeItem(item, reason)
        }
    }

    clear(testFn) {
        let removedCount = 0

        for (const keyStr in this._map) {
            const item = this._map[keyStr]

            if (!testFn || testFn(item.key, item.value) === true) {
                this._removeItem(item)
                removedCount++
            }
        }

        return removedCount
    }

    enumerate(fn) {
        for (const keyStr in this._map) {
            const item = this._map[keyStr]

            if (fn.call(this, item.key, item.value) === false)
                break
        }
    }

    _getOldestItem() {
        let node = this._tree.root

        while (node.left !== null)
            node = node.left

        return node.value
    }

    _removeItem(item, reason) {
        reason = reason || "Removed"

        if (typeof item.removeCallback === "function")
            item.removeCallback.apply(this, [item.key, item.value, reason])

        delete this._map[item.keyStr]
        this._tree.delete(item.order)
        this._size--

        this.itemRemoved.dispatch(item.key, item.value, reason)
    }

    _updateExpiration(item) {
        let expires

        if (item.expTimer != null) {
            clearTimeout(item.expTimer)
            item.expTimer = null
        }

        if (item.absoluteExpiration != null)
            expires = item.absoluteExpiration
        else if (item.slidingExpirationMsec != null)
            expires = new Date(new Date().getTime() + item.slidingExpirationMsec)

        if (expires) {
            const { keyStr } = item
            item.expTimer = setTimeout(this.remove.bind(this, keyStr, "Expired"), expires.getTime() - new Date().getTime())
        }
    }
}
