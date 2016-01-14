"use strict";
function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
}
exports.isArray = isArray;
function isObject(value) {
    var type = typeof value;
    return !!value && (type == "object" || type == "function");
}
exports.isObject = isObject;
function isFunction(value) {
    var tag = isObject(value) ? Object.toString.call(value) : "";
    return tag == "[object Function]" || tag == "[object GeneratorFunction]";
}
exports.isFunction = isFunction;
//# sourceMappingURL=utils.js.map