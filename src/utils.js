function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]"
}

function isObject(value) {
    var type = typeof value
    return !!value && (type == "object" || type == "function")
}

function isFunction(value) {
    var tag = isObject(value) ? Object.toString.call(value) : ""
    return tag == "[object Function]" || tag == "[object GeneratorFunction]"
}

module.exports = {
    isArray: isArray,
    isObject: isObject,
    isFunction: isFunction
}
