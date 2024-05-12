export class LRUCache<K, V> {
  private readonly MAX: number
  private readonly cache: Map<K, V>

  constructor (_MAX: number) {
    if (typeof _MAX !== 'number') throw new Error('Please set cache max size')

    this.MAX = _MAX
    this.cache = new Map()
  }

  public get (key: K): V | undefined {
    const item = this.cache.get(key)

    if (typeof item === 'boolean') {
      this.cache.delete(key)
      this.cache.set(key, item)
    }

    return item
  }

  public has (key: K): boolean {
    return this.cache.has(key)
  }

  public set (key: K, val: V): void {
    if (this.cache.has(key)) this.cache.delete(key)
    else if (this.cache.size === this.MAX) this.cache.delete(this.first())
    this.cache.set(key, val)
  }

  public clear (): void {
    this.cache.clear()
  }

  private first (): K {
    return this.cache.keys().next().value
  }
}
