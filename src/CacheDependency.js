var Signal = require("signals").Signal
var Utils = require("./Utils")

function CacheDependency(cachekeys, dependencies) {
    var me = this

    me._cachekeys = cachekeys ? (Utils.isArray(cachekeys) ? cachekeys : [cachekeys]) : []
    me._dependencies = dependencies ? (Utils.isArray(dependencies) ? dependencies : [dependencies]) : []

    me.triggered = new Signal()
    me._isTriggered = false

    me.attach = function(cache) {
        if (me._cache)
            throw new Error("CacheDependency.attach: dependency already attached")

        me._cache = cache

        if (me._cachekeys.length)
            cache.itemRemoved.add(_handleRemovedItem, me)

        for (var i = 0; i < me._dependencies.length; i++)
            me._dependencies[i].triggered.addOnce(_setTriggered, me)
    }

    me.detach = function() {
        if (me._cachekeys.length)
            me._cache.itemRemoved.remove(_handleRemovedItem, me)

        for (var i = 0; i < me._dependencies.length; i++)
            me._dependencies[i].triggered.remove(_setTriggered, me)

        me._cache = null
    }

    me.isTriggered = function() {
        return this._isTriggered
    }

    me.getLastModified = function() {
        return this._triggeredDate
    }

    function _handleRemovedItem(key, value, data, reason) {
        for (var i = 0; i < me._cachekeys.length; i++)
            if (me._cachekeys[i] === key) {
                _setTriggered()
                break
            }
    }

    function _setTriggered() {
        me.detach()

        me._isTriggered = true
        me._triggeredDate = new Date()

        me.triggered.dispatch()
    }
}

module.exports = CacheDependency
