var stringify = require("json-stable-stringify")
var Signal = require("signals").Signal
var Utils = require("./Utils")

function Cache(maxSize) {
    var me = this

    if (maxSize != null && maxSize <= 0)
        throw new Error("Cache.constructor: 'maxSize' shoud be greater than 0")

    me._items = []
    me.maxSize = maxSize
    me.itemRemoved = new Signal()

    me.insert = function(keyOrData, value, options) {
        options = options || {}

        var dependencies = options.dependencies
            ? (Utils.isArray(options.dependencies)
                ? options.dependencies
                : [options.dependencies])
            : []

        var absoluteExpiration = Utils.isFunction(options.absoluteExpiration)
            ? options.absoluteExpiration.call(options)
            : options.absoluteExpiration

        if (absoluteExpiration != null && !(absoluteExpiration instanceof Date))
            throw new Error("Cache.insert: 'absoluteExpiration' should be of type DateTime or null")

        if (value == null)
            throw new Error("Cache.insert: 'value' cannot be null or undefined")

        if (options.slidingExpirationMsec != null
            && (options.slidingExpirationMsec < 0
                || options.slidingExpirationMsec > 31536000000))
        {
            throw new Error("Cache.insert: allowed range for 'slidingExpirationMsec' is [0..31536000000] (up to year)")
        }

        me.remove(keyOrData, "Removed")

        var keyStruct = _getKeyStruct(keyOrData)

        var item = {
            key: keyStruct.key,
            data: keyStruct.data,
            value: value,
            slidingExpirationMsec: options.slidingExpirationMsec,
            removeCallback: options.removeCallback,
        }

        _updateExpiration(item, absoluteExpiration)

        if (me.maxSize != null && me.maxSize === me._items.length)
            _removeInternal(me._items[0], "Underused", 0)

        me._items.push(item)

        var dependencyTriggered = function() {
            for (var i = 0; i < dependencies.length; i++)
                dependencies[i].triggered.remove(dependencyTriggered)

            me.remove(keyOrData, "DependencyTriggered")
        }

        for (var i = 0; i < dependencies.length; i++) {
            var dependency = dependencies[i]
            dependency.attach(me)
            dependency.triggered.addOnce(dependencyTriggered)
        }

        _expirationCheck()
    }

    me.add = function(keyOrData, value, options) {
        var keyStruct = _getKeyStruct(keyOrData)
        var item = _getItem(keyStruct.key)

        if (item != null)
            return item.value
        else
            me.insert(keyOrData, value, options)
    }

    me.get = function(keyOrData, calcValue, addOptions) {
        var keyStruct = _getKeyStruct(keyOrData)
        var item = _getItem(keyStruct.key)

        if (item != null) {
            _updateExpiration(item)
            _expirationCheck()

            return item.value
        }
        else if (calcValue) {
            var value = calcValue()
            me.insert(keyOrData, value, addOptions)
            return value
        }
    }

    me.exists = function(keyOrDataOrArray) {
        var found = false

        _enumKeyStructs(keyOrDataOrArray, function(keyStruct) {
            if (!(found = (_getItem(keyStruct.key) != null)))
                return false
        })

        return found
    }

    me.remove = function(keyOrDataOrArray, reason) {
        _enumKeyStructs(keyOrDataOrArray, function(keyStruct) {
            var item = _getItem(keyStruct.key)

            if (item)
                _removeInternal(item, reason)

            return true
        })
    }

    me.clear = function(test) {
        var removedCount = me._items.length

        for (var i = me._items.length - 1; i >= 0; i--) {
            var item = me._items[i]

            if (!test || test(item.key, item.value, item.data) === true)
                _removeInternal(item, "Removed", i)
        }

        return removedCount
    }

    me.getCount = function() {
        return this._items.length
    }

    me.enumerate = function(fn) {
        for (var i = me._items.length - 1; i >= 0; i--) {
            var item = me._items[i]

            if (fn.call(me, item.key, item.value, item.data) === false)
                break
        }
    }

    function _getKeyStruct(keyOrData) {
        var keyStruct = {
            key: typeof keyOrData !== "string" ? stringify(keyOrData) : keyOrData,
            data: typeof keyOrData !== "string" ? keyOrData : null
        }

        if (keyStruct.key == null)
            throw new Error("Cache.getKeyStruct: empty key")

        return keyStruct
    }

    function _enumKeyStructs(keyOrDataOrArray, fn) {
        if (Utils.isArray(keyOrDataOrArray)) {
            var arr = keyOrDataOrArray
            if (!arr.length)
                throw new Error("Cache.enumKeyStructs: empty keys array")

            for (var i = 0; i < arr.length; i++)
                if (fn.call(me, _getKeyStruct(arr[i])) === false)
                    return
        }
        else
            fn.call(me, _getKeyStruct(keyOrDataOrArray))
    }

    function _removeInternal(item, reason, index) {
        reason = reason || "Removed"

        if (Utils.isFunction(item.removeCallback))
            item.removeCallback.apply(me, [item.key, item.value, item.data, reason])

        if (index == null)
            for (var i = 0; i < me._items.length; i++)
                if (me._items[i] === item) {
                    index = i
                    break
                }

        me._items.splice(index, 1)
        me.itemRemoved.dispatch(item.key, item.value, item.data, reason)
    }

    function _expirationCheck() {
        if (me._expCheckTimer != null) {
            clearInterval(me._expCheckTimer)
            me._expCheckTimer = null
        }

        var nowTicks = new Date().getTime()
        var nextItem = null
        var i = 0

        while (i < me._items.length) {
            var item = me._items[i]
            var removed = false

            if (item.expires) {
                var ticks = item.expires.getTime()

                if (nowTicks >= ticks) {
                    _removeInternal(item, "Expired", i)
                    removed = true
                }
                else if (!nextItem || ticks < nextItem.expires.getTime())
                    nextItem = item
            }

            if (!removed)
                i++
        }

        if (nextItem)
            me._expCheckTimer = setTimeout(_expirationCheck.bind(me), nextItem.expires.getTime() - nowTicks + 499)
    }

    function _updateExpiration(item, absoluteExpiration) {
        if (absoluteExpiration != null)
            item.expires = absoluteExpiration
        else if (item.slidingExpirationMsec != null)
            item.expires = new Date(new Date().getTime() + item.slidingExpirationMsec)
    }

    function _getItem(keyOrData) {
        var keyStruct = _getKeyStruct(keyOrData)

        for (var i = 0; i < me._items.length; i++) {
            var item = me._items[i]

            if (item.key === keyStruct.key)
                return item
        }
    }
}

module.exports = Cache
