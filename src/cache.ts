/// <reference path="../typings/tsd.d.ts" />

import * as Utils from "./utils"
var stringify = require("json-stable-stringify");
import { Signal } from "signals"

export interface CacheKeyStruct {
    key: string;
    data;
}

export interface CacheItem extends CacheKeyStruct {
    value;
    slidingExpirationMsec: number;
    expires: Date;
    removeCallback: (key: string, value, data, reason: string) => any;
}

export interface CacheOptions {
    dependencies?: CacheDependency | CacheDependency[];
    slidingExpirationMsec?: number;
    absoluteExpiration?: Date | ((options: CacheOptions) => Date);
    removeCallback?: (key: string, value, data, reason: string) => any;
}

export default class Cache
{
    maxSize: number;
    itemRemoved = new Signal();

    private _items: CacheItem[] = [];
    private _expCheckTimer: number;

    constructor(maxSize?: number) {
        if (maxSize != null && maxSize <= 0)
            throw "Cache.constructor: 'maxSize' shoud be greater than 0";

        this.maxSize = maxSize;
    }

    insert(keyOrData: string | Object, value, options: CacheOptions = <CacheOptions>{}) {
        let dependencies: CacheDependency[] = options.dependencies
            ? (Utils.isArray(options.dependencies)
                ? options.dependencies as any
                : [options.dependencies])
            : [];

        let absoluteExpiration: Date = Utils.isFunction(options.absoluteExpiration)
            ? (options.absoluteExpiration as ((options: CacheOptions) => Date)).call(options)
            : options.absoluteExpiration;

        if (absoluteExpiration != null && !(absoluteExpiration instanceof Date))
            throw "Cache.insert: 'absoluteExpiration' should be of type DateTime or null";

        if (value == null)
            throw "Cache.insert: 'value' cannot be null or undefined";

        if (options.slidingExpirationMsec != null
            && (options.slidingExpirationMsec < 0
                || options.slidingExpirationMsec > 31536000000))
        {
            throw "Cache.insert: allowed range for 'slidingExpirationMsec' is [0..31536000000] (up to year)";
        }

        this.remove(keyOrData, "Removed");

        let keyStruct = this.getKeyStruct(keyOrData);

        let item = {
            key: keyStruct.key,
            data: keyStruct.data,
            value: value,
            slidingExpirationMsec: options.slidingExpirationMsec,
            removeCallback: options.removeCallback,
        } as CacheItem;

        this.updateExpiration(item, absoluteExpiration);

        if (this.maxSize != null && this.maxSize === this._items.length)
            this.removeInternal(this._items[0], "Underused", 0);

        this._items.push(item);

        let dependencyChanged = () => {
            for (let i = 0; i < dependencies.length; i++)
                dependencies[i].triggered.remove(dependencyChanged);

            this.remove(keyOrData, "DependencyChanged");
        };

        for (let i = 0; i < dependencies.length; i++) {
            let dependency = dependencies[i];
            dependency.attach(this);
            dependency.triggered.addOnce(dependencyChanged);
        }

        this.expirationCheck();
    }

    add(keyOrData: string | Object, value, options?: CacheOptions) {
        let keyStruct = this.getKeyStruct(keyOrData);
        let item = this.getItem(keyStruct.key);

        if (item != null)
            return item.value;
        else
            this.insert(keyOrData, value, options);
    }

    get(keyOrData: string | Object, calcValue?: () => any, addOptions?: CacheOptions) {
        let keyStruct = this.getKeyStruct(keyOrData);
        let item = this.getItem(keyStruct.key);

        if (item != null) {
            this.updateExpiration(item);
            this.expirationCheck();

            return item.value;
        }
        else if (calcValue) {
            let value = calcValue();
            this.insert(keyOrData, value, addOptions);
            return value;
        }
    }

    exists(keyOrDataOrArray: string | Object | any[]) {
        let found = false;

        this.enumKeyStructs(keyOrDataOrArray, keyStruct => {
            if (!(found = (this.getItem(keyStruct.key) != null)))
                return false;
        });

        return found;
    }

    remove(keyOrDataOrArray: string | Object | any[], reason?: string) {
        this.enumKeyStructs(keyOrDataOrArray, keyStruct => {
            let item = this.getItem(keyStruct.key);

            if (item)
                this.removeInternal(item, reason);

            return true;
        });
    }

    clear(test?: (key: string, value, data) => boolean) {
        let removedCount = this._items.length;

        for (let i = this._items.length - 1; i >= 0; i--) {
            let item = this._items[i];

            if (!test || test(item.key, item.value, item.data) === true)
                this.removeInternal(item, "Removed", i);
        }

        return removedCount;
    }

    getCount() {
        return this._items.length;
    }

    enumerate(fn: (key: string, value, data) => boolean) {
        for (let i = this._items.length - 1; i >= 0; i--) {
            let item = this._items[i];

            if (fn.call(this, item.key, item.value, item.data) === false)
                break;
        }
    }

    private getKeyStruct(keyOrData: string | Object): CacheKeyStruct {
        let keyStruct = <CacheKeyStruct>{
            key: typeof keyOrData !== "string" ? stringify(keyOrData) : keyOrData,
            data: typeof keyOrData !== "string" ? keyOrData : null
        }

        if (keyStruct.key == null)
            throw "Cache.getKeyStruct: empty key";

        return keyStruct;
    }

    private enumKeyStructs(keyOrDataOrArray: string | Object | any[], fn: (keyStruct: CacheKeyStruct) => boolean) {
        if (Utils.isArray(keyOrDataOrArray)) {
            let arr = keyOrDataOrArray as any[];
            if (!arr.length)
                throw "Cache.enumKeyStructs: empty keys array";

            for (let i = 0; i < arr.length; i++)
                if (fn.call(this, this.getKeyStruct(arr[i])) === false)
                    return;
        }
        else
            fn.call(this, this.getKeyStruct(keyOrDataOrArray));
    }

    private removeInternal(item: CacheItem, reason?: string, index?: number) {
        reason = reason || "Removed";

        if (Utils.isFunction(item.removeCallback))
            item.removeCallback.apply(this, [item.key, item.value, item.data, reason]);

        if (index == null)
            for (let i = 0; i < this._items.length; i++)
                if (this._items[i] === item) {
                    index = i;
                    break;
                }

        this._items.splice(index, 1);
        this.itemRemoved.dispatch(item.key, item.value, item.data, reason);
    }

    private expirationCheck() {
        if (this._expCheckTimer != null) {
            clearInterval(this._expCheckTimer);
            this._expCheckTimer = null;
        }

        let nowTicks = new Date().getTime();
        let nextItem: CacheItem = null;
        let i = 0;

        while (i < this._items.length) {
            let item = this._items[i];
            let removed = false;

            if (item.expires) {
                let ticks = item.expires.getTime();

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
            this._expCheckTimer = <any>setTimeout(() => {
                this.expirationCheck();
            }, nextItem.expires.getTime() - nowTicks + 499);
    }

    private updateExpiration(item: CacheItem, absoluteExpiration?: Date) {
        if (absoluteExpiration != null)
            item.expires = absoluteExpiration;
        else if (item.slidingExpirationMsec != null)
            item.expires = new Date(new Date().getTime() + item.slidingExpirationMsec);
    }

    private getItem(keyOrData: string | Object) {
        let keyStruct = this.getKeyStruct(keyOrData);

        for (let i = 0; i < this._items.length; i++) {
            let item = this._items[i];

            if (item.key === keyStruct.key)
                return item;
        }
    }
}

export class CacheDependency
{
    triggered = new Signal();

    private _cachekeys: string[];
    private _dependencies: CacheDependency[];
    private _cache: Cache;
    private _isTriggered = false;
    private _triggeredDate: Date;

    constructor(
        cachekeys: string | string[],
        dependencies?: CacheDependency | CacheDependency[]
    ) {
        this._cachekeys = cachekeys ? <any>(Utils.isArray(cachekeys) ? cachekeys : [cachekeys]) : [];
        this._dependencies = dependencies ? <any>(Utils.isArray(dependencies) ? dependencies : [dependencies]) : [];
    }

    attach(cache: Cache) {
        if (this._cache)
            throw "CacheDependency.attach: dependency already attached";

        this._cache = cache;

        if (this._cachekeys.length)
            cache.itemRemoved.add(this.handleRemovedItem, this);

        for (let i = 0; i < this._dependencies.length; i++)
            this._dependencies[i].triggered.addOnce(this.setTriggered, this);
    }

    detach() {
        if (this._cachekeys.length)
            this._cache.itemRemoved.remove(this.handleRemovedItem, this);

        for (let i = 0; i < this._dependencies.length; i++)
            this._dependencies[i].triggered.remove(this.setTriggered, this);

        this._cache = null;
    }

    isTriggered() {
        return this._isTriggered;
    }

    getLastModified() {
        return this._triggeredDate;
    }

    private handleRemovedItem(key: string, value, data, reason: string) {
        for (let i = 0; i < this._cachekeys.length; i++)
            if (this._cachekeys[i] === key) {
                this.setTriggered();
                break;
            }
    }

    private setTriggered() {
        this.detach();
        this._isTriggered = true;
        this._triggeredDate = new Date();
        this.triggered.dispatch();
    }
}
