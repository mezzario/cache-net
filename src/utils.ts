/// <reference path="../typings/tsd.d.ts" />

export function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
}

export function isObject(value) {
    var type = typeof value;
    return !!value && (type == "object" || type == "function");
}

export function isFunction(value) {
    var tag = isObject(value) ? Object.toString.call(value) : "";
    return tag == "[object Function]" || tag == "[object GeneratorFunction]";
}
