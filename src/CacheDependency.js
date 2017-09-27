import {Signal} from "signals"
import * as Utils from "./Utils"

export default class CacheDependency {
  constructor(keys, dependencies) {
    this._map = Object.create(null);

    (keys ? (Array.isArray(keys) ? keys : [keys]) : [])
      .forEach(key => {
        const keyStruct = Utils.getKeyStruct(key)
        this._map[keyStruct.keyStr] = key
      })

    this._deps = dependencies ? (Array.isArray(dependencies) ? dependencies : [dependencies]) : []

    for (let i = 0; i < this._deps.length; i++)
      if (!(this._deps[i] instanceof CacheDependency))
        throw new Error("'dependencies' should be one or more 'CacheDependency' instances")

    this.triggered = new Signal()
    this._isTriggered = false
  }

  isTriggered() {
    return this._isTriggered
  }

  getLastModified() {
    return this._triggeredDate
  }

  _hasKeys() {
    let has = false

    for (const __ in this._map) {
      has = true
      break
    }

    return has
  }

  _attach(cache) {
    if (this._cache)
      throw new Error("dependency already attached")

    this._cache = cache

    if (this._hasKeys())
      cache.itemRemoved.add(this._handleRemovedItem, this)

    for (let i = 0; i < this._deps.length; i++)
      this._deps[i].triggered.addOnce(this._setTriggered, this)
  }

  _detach() {
    if (this._hasKeys())
      this._cache.itemRemoved.remove(this._handleRemovedItem, this)

    for (let i = 0; i < this._deps.length; i++)
      this._deps[i].triggered.remove(this._setTriggered, this)

    this._cache = null
  }

  _handleRemovedItem(key/*, value, reason*/) {
    const keyStruct = Utils.getKeyStruct(key)

    if (this._map[keyStruct.keyStr] !== void 0)
      this._setTriggered()
  }

  _setTriggered() {
    this._detach()

    this._isTriggered = true
    this._triggeredDate = new Date()

    this.triggered.dispatch()
  }
}

module.exports = CacheDependency
