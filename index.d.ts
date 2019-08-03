import {Signal} from 'signals'

export interface CacheOptions {
  dependencies?: CacheDependency | CacheDependency[]
  slidingExpirationMsec?: number
  absoluteExpiration?: Date | ((options: CacheOptions) => Date)
  removeCallback?: (key: string, value, reason: string) => any
}

export default class Cache {
  maxSize: number
  size: number
  itemRemoved: Signal

  constructor(maxSize: number)

  set(key, value, options?: CacheOptions): void
  get(key)
  has(key: any | any[]): boolean
  remove(key: any | any[], reason?: string): void
  clear(testFn?: (key, value) => boolean): number
  enumerate(fn: (key, data) => boolean): void
}

export class CacheDependency {
  triggered: Signal

  constructor(keys: any | any[], dependencies: CacheDependency | CacheDependency[])

  isTriggered(): boolean
  getLastModified(): Date
}
