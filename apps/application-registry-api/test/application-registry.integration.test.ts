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

  for (const filters of [
    [
      {
        type: 'condition',
        field: 'notARegistryField',
        operator: 'eq',
        value: 'anything',
      },
    ],
    [
      {
        type: 'condition',
        field: 'company',
        operator: 'dropTable',
        value: 'anything',
      },
    ],
  ]) {
    const invalidQuery = new URLSearchParams({
      filters: JSON.stringify(filters),
    })
    const response = await harness.fetchRegistry(
      `/v1/applications?${invalidQuery}`
    )
    assert.equal(response.status, 400)
    assert.equal(await response.text(), '')
  }
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

test('exposes create-only CRUD, cross-field search, metadata patches, and optimistic deletion', async () => {
  const createdResponse = await harness.fetchRegistry('/v1/applications', {
    body: JSON.stringify(applicationInput),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  assert.equal(createdResponse.status, 200)
  const created = Schema.decodeUnknownSync(
    Schema.Struct({ id: Schema.String, version: Schema.Number })
  )(await createdResponse.json())

  const duplicate = await harness.fetchRegistry('/v1/applications', {
    body: JSON.stringify(applicationInput),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  assert.equal(duplicate.status, 409)

  const searchQuery = new URLSearchParams({
    filters: JSON.stringify([
      {
        type: 'condition',
        field: 'q',
        operator: 'matches',
        value: 'e2e-registry',
      },
    ]),
    orderBy: JSON.stringify([{ field: 'company', direction: 'asc' }]),
    size: '100',
  })
  const searched = await harness.fetchRegistry(
    `/v1/applications?${searchQuery}`
  )
  assert.equal(searched.status, 200)
  const searchResult = Schema.decodeUnknownSync(
    Schema.Struct({ items: Schema.Array(Schema.Struct({ id: Schema.String })) })
  )(await searched.json())
  assert.deepEqual(searchResult.items, [{ id: created.id }])

  const patchResponse = await harness.fetchRegistry(
    `/v1/applications/${created.id}`,
    {
      body: JSON.stringify({
        canonicalUrl: 'https://example.com/jobs/e2e-registry-updated',
        company: 'Updated Example Company',
        expectedVersion: created.version,
        location: 'Remote from Europe',
        role: 'Updated Integration Engineer',
        source: 'official',
        sourceJobId: 'official-42',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    }
  )
  assert.equal(patchResponse.status, 200)
  const patched = Schema.decodeUnknownSync(
    Schema.Struct({
      company: Schema.String,
      version: Schema.Number,
    })
  )(await patchResponse.json())
  assert.equal(patched.company, 'Updated Example Company')

  const staleDelete = await harness.fetchRegistry(
    `/v1/applications/${created.id}?expectedVersion=${created.version}`,
    { method: 'DELETE' }
  )
  assert.equal(staleDelete.status, 409)

  const removed = await harness.fetchRegistry(
    `/v1/applications/${created.id}?expectedVersion=${patched.version}`,
    { method: 'DELETE' }
  )
  assert.equal(removed.status, 204)
})
