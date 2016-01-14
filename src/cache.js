/// <reference path="../typings/tsd.d.ts" />
"use strict";
var Utils = require("./utils");
var stringify = require("json-stable-stringify");
var signals_1 = require("signals");
var Cache = (function () {
    function Cache(maxSize) {
        this.itemRemoved = new signals_1.Signal();
        this._items = [];
        if (maxSize != null && maxSize <= 0)
            throw "Cache.constructor: 'maxSize' shoud be greater than 0";
        this.maxSize = maxSize;
    }
    Cache.prototype.insert = function (keyOrData, value, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        var dependencies = options.dependencies
            ? (Utils.isArray(options.dependencies)
                ? options.dependencies
                : [options.dependencies])
            : [];
        var absoluteExpiration = Utils.isFunction(options.absoluteExpiration)
            ? options.absoluteExpiration.call(options)
            : options.absoluteExpiration;
        if (absoluteExpiration != null && !(absoluteExpiration instanceof Date))
            throw "Cache.insert: 'absoluteExpiration' should be of type DateTime or null";
        if (value == null)
            throw "Cache.insert: 'value' cannot be null or undefined";
        if (options.slidingExpirationMsec != null
            && (options.slidingExpirationMsec < 0
                || options.slidingExpirationMsec > 31536000000)) {
            throw "Cache.insert: allowed range for 'slidingExpirationMsec' is [0..31536000000] (up to year)";
        }
        this.remove(keyOrData, "Removed");
        var keyStruct = this.getKeyStruct(keyOrData);
        var item = {
            key: keyStruct.key,
            data: keyStruct.data,
            value: value,
            slidingExpirationMsec: options.slidingExpirationMsec,
            removeCallback: options.removeCallback,
        };
        this.updateExpiration(item, absoluteExpiration);
        if (this.maxSize != null && this.maxSize === this._items.length)
            this.removeInternal(this._items[0], "Underused", 0);
        this._items.push(item);
        var dependencyChanged = function () {
            for (var i = 0; i < dependencies.length; i++)
                dependencies[i].triggered.remove(dependencyChanged);
            _this.remove(keyOrData, "DependencyChanged");
        };
        for (var i = 0; i < dependencies.length; i++) {
            var dependency = dependencies[i];
            dependency.attach(this);
            dependency.triggered.addOnce(dependencyChanged);
        }
        this.expirationCheck();
    };
    Cache.prototype.add = function (keyOrData, value, options) {
        var keyStruct = this.getKeyStruct(keyOrData);
        var item = this.getItem(keyStruct.key);
        if (item != null)
            return item.value;
        else
            this.insert(keyOrData, value, options);
    };
    Cache.prototype.get = function (keyOrData, calcValue, addOptions) {
        var keyStruct = this.getKeyStruct(keyOrData);
        var item = this.getItem(keyStruct.key);
        if (item != null) {
            this.updateExpiration(item);
            this.expirationCheck();
            return item.value;
        }
        else if (calcValue) {
            var value = calcValue();
            this.insert(keyOrData, value, addOptions);
            return value;
        }
    };
    Cache.prototype.exists = function (keyOrDataOrArray) {
        var _this = this;
        var found = false;
        this.enumKeyStructs(keyOrDataOrArray, function (keyStruct) {
            if (!(found = (_this.getItem(keyStruct.key) != null)))
                return false;
        });
        return found;
    };
    Cache.prototype.remove = function (keyOrDataOrArray, reason) {
        var _this = this;
        this.enumKeyStructs(keyOrDataOrArray, function (keyStruct) {
            var item = _this.getItem(keyStruct.key);
            if (item)
                _this.removeInternal(item, reason);
            return true;
        });
    };
    Cache.prototype.clear = function (test) {
        var removedCount = this._items.length;
        for (var i = this._items.length - 1; i >= 0; i--) {
            var item = this._items[i];
            if (!test || test(item.key, item.value, item.data) === true)
                this.removeInternal(item, "Removed", i);
        }
        return removedCount;
    };
    Cache.prototype.getCount = function () {
        return this._items.length;
    };
    Cache.prototype.enumerate = function (fn) {
        for (var i = this._items.length - 1; i >= 0; i--) {
            var item = this._items[i];
            if (fn.call(this, item.key, item.value, item.data) === false)
                break;
        }
    };
    Cache.prototype.getKeyStruct = function (keyOrData) {
        var keyStruct = {
            key: typeof keyOrData !== "string" ? stringify(keyOrData) : keyOrData,
            data: typeof keyOrData !== "string" ? keyOrData : null
        };
        if (keyStruct.key == null)
            throw "Cache.getKeyStruct: empty key";
        return keyStruct;
    };
    Cache.prototype.enumKeyStructs = function (keyOrDataOrArray, fn) {
        if (Utils.isArray(keyOrDataOrArray)) {
            var arr = keyOrDataOrArray;
            if (!arr.length)
                throw "Cache.enumKeyStructs: empty keys array";
            for (var i = 0; i < arr.length; i++)
                if (fn.call(this, this.getKeyStruct(arr[i])) === false)
                    return;
        }
        else
            fn.call(this, this.getKeyStruct(keyOrDataOrArray));
    };
    Cache.prototype.removeInternal = function (item, reason, index) {
        reason = reason || "Removed";
        if (Utils.isFunction(item.removeCallback))
            item.removeCallback.apply(this, [item.key, item.value, item.data, reason]);
        if (index == null)
            for (var i = 0; i < this._items.length; i++)
                if (this._items[i] === item) {
                    index = i;
                    break;
                }
        this._items.splice(index, 1);
        this.itemRemoved.dispatch(item.key, item.value, item.data, reason);
    };
    Cache.prototype.expirationCheck = function () {
        var _this = this;
        if (this._expCheckTimer != null) {
            clearInterval(this._expCheckTimer);
            this._expCheckTimer = null;
        }
        var nowTicks = new Date().getTime();
        var nextItem = null;
        var i = 0;
        while (i < this._items.length) {
            var item = this._items[i];
            var removed = false;
            if (item.expires) {
                var ticks = item.expires.getTime();
                if (nowTicks >= ticks) {
                    this.removeInternal(item, "Expired", i);
                    removed = true;
                }
                else if (!nextItem || ticks < nextItem.expires.getTime())
                    nextItem = item;
            }
            if (!removed)
                i++;
        }
        if (nextItem)
            this._expCheckTimer = setTimeout(function () {
                _this.expirationCheck();
            }, nextItem.expires.getTime() - nowTicks + 499);
    };
    Cache.prototype.updateExpiration = function (item, absoluteExpiration) {
        if (absoluteExpiration != null)
            item.expires = absoluteExpiration;
        else if (item.slidingExpirationMsec != null)
            item.expires = new Date(new Date().getTime() + item.slidingExpirationMsec);
    };
    Cache.prototype.getItem = function (keyOrData) {
        var keyStruct = this.getKeyStruct(keyOrData);
        for (var i = 0; i < this._items.length; i++) {
            var item = this._items[i];
            if (item.key === keyStruct.key)
                return item;
        }
    };
    return Cache;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Cache;
var CacheDependency = (function () {
    function CacheDependency(cachekeys, dependencies) {
        this.triggered = new signals_1.Signal();
        this._isTriggered = false;
        this._cachekeys = cachekeys ? (Utils.isArray(cachekeys) ? cachekeys : [cachekeys]) : [];
        this._dependencies = dependencies ? (Utils.isArray(dependencies) ? dependencies : [dependencies]) : [];
    }
    CacheDependency.prototype.attach = function (cache) {
        if (this._cache)
            throw "CacheDependency.attach: dependency already attached";
        this._cache = cache;
        if (this._cachekeys.length)
            cache.itemRemoved.add(this.handleRemovedItem, this);
        for (var i = 0; i < this._dependencies.length; i++)
            this._dependencies[i].triggered.addOnce(this.setTriggered, this);
    };
    CacheDependency.prototype.detach = function () {
        if (this._cachekeys.length)
            this._cache.itemRemoved.remove(this.handleRemovedItem, this);
        for (var i = 0; i < this._dependencies.length; i++)
            this._dependencies[i].triggered.remove(this.setTriggered, this);
        this._cache = null;
    };
    CacheDependency.prototype.isTriggered = function () {
        return this._isTriggered;
    };
    CacheDependency.prototype.getLastModified = function () {
        return this._triggeredDate;
    };
    CacheDependency.prototype.handleRemovedItem = function (key, value, data, reason) {
        for (var i = 0; i < this._cachekeys.length; i++)
            if (this._cachekeys[i] === key) {
                this.setTriggered();
                break;
            }
    };
    CacheDependency.prototype.setTriggered = function () {
        this.detach();
        this._isTriggered = true;
        this._triggeredDate = new Date();
        this.triggered.dispatch();
    };
    return CacheDependency;
}());
exports.CacheDependency = CacheDependency;
//# sourceMappingURL=cache.js.map