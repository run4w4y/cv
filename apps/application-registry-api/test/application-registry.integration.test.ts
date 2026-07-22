import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { after, afterEach, before, test } from 'node:test'
import { Schema } from 'effect'
import { registerApplicationRegistryE2eTests } from './application-registry.e2e.test'
import { applicationInput } from './fixtures'
import { RegistryApiHarness } from './support/registry-api'

let harness: RegistryApiHarness

before(
  async () => {
    harness = await RegistryApiHarness.make()
  },
  { timeout: 120_000 }
)

afterEach(
  async () => {
    await harness.reset()
  },
  { timeout: 30_000 }
)

after(
  async () => {
    await harness?.dispose()
  },
  { timeout: 60_000 }
)

const ErrorCodeSchema = Schema.Struct({ code: Schema.String })
const jsonRequest = (
  body: unknown,
  method: string,
  headers: Readonly<Record<string, string>> = {}
) => ({
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...headers },
  method,
})

test('enforces authentication and drizzle-query codecs at the HTTP boundary', async () => {
  const unauthorized = await fetch(
    new URL('/api/registry/applications', harness.url),
    { headers: { authorization: 'Bearer invalid-token' } }
  )
  assert.equal(unauthorized.status, 401)
  assert.equal(unauthorized.headers.get('cache-control'), 'private, no-store')
  assert.equal(
    Schema.decodeUnknownSync(ErrorCodeSchema)(await unauthorized.json()).code,
    'unauthorized'
  )

  const invalidPayload = await harness.fetchRegistry(
    '/api/registry/applications',
    jsonRequest({}, 'POST')
  )
  assert.equal(invalidPayload.status, 400)

  for (const filter of [
    'notARegistryField:eq:anything',
    'company:dropTable:anything',
  ]) {
    const query = new URLSearchParams({ filter })
    const response = await harness.fetchRegistry(
      `/api/registry/applications?${query.toString()}`
    )
    assert.equal(response.status, 400)
  }

  const obsolete = await harness.fetchRegistry(
    '/api/registry/applications?filters=whatever&orderBy=whatever'
  )
  assert.equal(obsolete.status, 200)
})

test('maps create, not-found, duplicate, and stale-update outcomes to HTTP', async () => {
  const missing = await harness.fetchRegistry(
    '/api/registry/applications/missing-application'
  )
  assert.equal(missing.status, 404)
  assert.equal(
    Schema.decodeUnknownSync(ErrorCodeSchema)(await missing.json()).code,
    'not_found'
  )

  const createdResponse = await harness.fetchRegistry(
    '/api/registry/applications',
    jsonRequest(applicationInput, 'POST')
  )
  assert.equal(createdResponse.status, 201)
  const created = Schema.decodeUnknownSync(
    Schema.Struct({ id: Schema.String, version: Schema.Number })
  )(await createdResponse.json())

  const duplicate = await harness.fetchRegistry(
    '/api/registry/applications',
    jsonRequest(applicationInput, 'POST')
  )
  assert.equal(duplicate.status, 409)

  const staleUpdate = await harness.fetchRegistry(
    `/api/registry/applications/${created.id}`,
    jsonRequest(
      {
        expectedVersion: created.version - 1,
        location: 'Remote',
      },
      'PATCH',
      { 'idempotency-key': 'stale-update-1' }
    )
  )
  assert.equal(staleUpdate.status, 409)
  assert.equal(
    Schema.decodeUnknownSync(ErrorCodeSchema)(await staleUpdate.json()).code,
    'conflict'
  )
})

test('uses raw blob bodies and content-addressed references for revisions', async () => {
  const createdResponse = await harness.fetchRegistry(
    '/api/registry/applications',
    jsonRequest(applicationInput, 'POST')
  )
  assert.equal(createdResponse.status, 201)
  const application = (await createdResponse.json()) as {
    readonly id: string
  }

  const bytes = new TextEncoder().encode(
    JSON.stringify({ sections: [{ type: 'summary', value: 'Exact bytes' }] })
  )
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const uploaded = await harness.fetchRegistry(
    `/api/registry/blobs/${sha256}`,
    {
      body: bytes,
      headers: { 'content-type': 'application/octet-stream' },
      method: 'PUT',
    }
  )
  assert.equal(uploaded.status, 200)
  assert.deepEqual(await uploaded.json(), {
    byteLength: bytes.byteLength,
    sha256,
  })

  const ensured = await harness.fetchRegistry(
    `/api/registry/applications/${application.id}/content-entries/cv/en`,
    { method: 'PUT' }
  )
  assert.equal(ensured.status, 200)
  const entry = (await ensured.json()) as {
    readonly id: string
    readonly version: number
  }

  const appended = await harness.fetchRegistry(
    `/api/registry/applications/${application.id}/content-entries/${entry.id}/revisions`,
    jsonRequest(
      {
        blob: { mediaType: 'application/json', sha256 },
        contractId: '@cv/contracts/cv-document',
        contractVersion: '1',
        expectedVersion: entry.version,
        source: 'ai',
      },
      'POST',
      { 'idempotency-key': 'revision-1' }
    )
  )
  assert.equal(appended.status, 201)
  const revision = (await appended.json()) as {
    readonly entry: { readonly version: number }
    readonly revision: { readonly id: string; readonly sha256: string }
  }
  assert.equal(revision.revision.sha256, sha256)

  const metadata = await harness.fetchRegistry(
    `/api/registry/applications/${application.id}/content-entries/${entry.id}/revisions/${revision.revision.id}`
  )
  assert.equal(metadata.status, 200)
  assert.equal(
    ((await metadata.json()) as { revision: { sha256: string } }).revision
      .sha256,
    sha256
  )

  const downloaded = await harness.fetchRegistry(
    `/api/registry/applications/${application.id}/content-entries/${entry.id}/revisions/${revision.revision.id}/content`
  )
  assert.equal(downloaded.status, 200)
  assert.equal(
    downloaded.headers.get('content-type'),
    'application/octet-stream'
  )
  assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), bytes)

  const approved = await harness.fetchRegistry(
    `/api/registry/applications/${application.id}/content-entries/${entry.id}`,
    jsonRequest(
      {
        approvedRevisionId: revision.revision.id,
        expectedVersion: revision.entry.version,
      },
      'PATCH'
    )
  )
  assert.equal(approved.status, 200)
  assert.equal(
    ((await approved.json()) as { entry: { state: string } }).entry.state,
    'approved'
  )
})

registerApplicationRegistryE2eTests(() => harness)
