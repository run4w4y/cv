import type { KVNamespace } from '@cloudflare/workers-types'
import type { KeyValueStore } from '@opencoredev/loginwithchatgpt-server'

const minimumCloudflareKvTtlSeconds = 60

export class CloudflareKvStore<T> implements KeyValueStore<T> {
  readonly #namespace: KVNamespace
  readonly #prefix: string

  constructor(namespace: KVNamespace, prefix: string) {
    this.#namespace = namespace
    this.#prefix = prefix
  }

  async get(key: string): Promise<T | undefined> {
    const value = await this.#namespace.get<T>(this.#key(key), 'json')
    return value ?? undefined
  }

  async set(
    key: string,
    value: T,
    options: { readonly ttlMs?: number } = {}
  ): Promise<void> {
    const expirationTtl =
      options.ttlMs === undefined
        ? undefined
        : Math.max(
            minimumCloudflareKvTtlSeconds,
            Math.ceil(options.ttlMs / 1_000)
          )

    await this.#namespace.put(this.#key(key), JSON.stringify(value), {
      expirationTtl,
    })
  }

  async delete(key: string): Promise<void> {
    await this.#namespace.delete(this.#key(key))
  }

  #key(key: string) {
    return `${this.#prefix}:${key}`
  }
}
