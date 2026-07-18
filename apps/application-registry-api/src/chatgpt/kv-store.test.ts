import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { KVNamespace } from '@cloudflare/workers-types'

import { CloudflareKvStore } from './kv-store'

type PutOptions = { readonly expirationTtl?: number }

const makeNamespace = () => {
  const values = new Map<string, string>()
  const puts: { key: string; options: PutOptions; value: string }[] = []
  const namespace = {
    delete: async (key: string) => {
      values.delete(key)
    },
    get: async (key: string) => {
      const value = values.get(key)
      return value === undefined ? null : JSON.parse(value)
    },
    put: async (key: string, value: string, options: PutOptions) => {
      values.set(key, value)
      puts.push({ key, options, value })
    },
  } as unknown as KVNamespace

  return { namespace, puts, values }
}

test('stores namespaced JSON and rounds TTL up to Cloudflare KV limits', async () => {
  const { namespace, puts } = makeNamespace()
  const store = new CloudflareKvStore<{ readonly status: string }>(
    namespace,
    'session'
  )

  await store.set('abc', { status: 'pending' }, { ttlMs: 1_001 })

  assert.deepEqual(await store.get('abc'), { status: 'pending' })
  assert.equal(puts[0]?.key, 'session:abc')
  assert.equal(puts[0]?.options.expirationTtl, 60)

  await store.delete('abc')
  assert.equal(await store.get('abc'), undefined)
})

test('stores durable values without an expiration option', async () => {
  const { namespace, puts } = makeNamespace()
  const store = new CloudflareKvStore<number>(namespace, 'rate')

  await store.set('abc', 1)

  assert.equal(puts[0]?.options.expirationTtl, undefined)
})
