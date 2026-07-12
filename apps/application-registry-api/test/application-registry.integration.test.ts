import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { Schema } from 'effect'

import { applicationInput } from './fixtures'
import { RegistryWorkerHarness } from './support/registry-worker'

let harness: RegistryWorkerHarness

beforeEach(async () => {
  harness = await RegistryWorkerHarness.make()
})

afterEach(async () => {
  await harness.dispose()
})

const ErrorCodeSchema = Schema.Struct({ code: Schema.String })

test('routes authentication and request codec failures at the Worker boundary', async () => {
  const unauthorized = await fetch(new URL('/v1/applications', harness.url))
  assert.equal(unauthorized.status, 401)
  assert.equal(unauthorized.headers.get('cache-control'), 'private, no-store')
  assert.equal(
    Schema.decodeUnknownSync(ErrorCodeSchema)(await unauthorized.json()).code,
    'unauthorized'
  )

  const invalidPayload = await harness.fetchRegistry('/v1/applications', {
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
    method: 'PUT',
  })
  assert.equal(invalidPayload.status, 400)
  assert.equal(await invalidPayload.text(), '')
})

test('maps live service not-found and conflict failures to HTTP statuses', async () => {
  const missing = await harness.fetchRegistry(
    '/v1/applications/missing-application'
  )
  assert.equal(missing.status, 404)
  assert.equal(
    Schema.decodeUnknownSync(ErrorCodeSchema)(await missing.json()).code,
    'not_found'
  )

  const createdResponse = await harness.fetchRegistry('/v1/applications', {
    body: JSON.stringify(applicationInput),
    headers: { 'content-type': 'application/json' },
    method: 'PUT',
  })
  assert.equal(createdResponse.status, 200)
  const created = Schema.decodeUnknownSync(
    Schema.Struct({ id: Schema.String, version: Schema.Number })
  )(await createdResponse.json())

  const stalePatch = await harness.fetchRegistry(
    `/v1/applications/${created.id}`,
    {
      body: JSON.stringify({
        expectedVersion: created.version - 1,
        fitScore: 99,
      }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    }
  )
  assert.equal(stalePatch.status, 409)
  assert.equal(
    Schema.decodeUnknownSync(ErrorCodeSchema)(await stalePatch.json()).code,
    'conflict'
  )
})
