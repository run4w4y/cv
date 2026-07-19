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
        location: 'Remote',
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

test('publishes exact immutable facts bytes through a versioned channel', async () => {
  const encode = (value: string | Uint8Array) =>
    Buffer.from(value).toString('base64')
  const jsonRequest = (body: unknown, method = 'POST') => ({
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method,
  })
  const putObject = async (bytes: Uint8Array) => {
    const response = await harness.fetchRegistry(
      '/v1/objects',
      jsonRequest({ data: encode(bytes) })
    )
    assert.equal(response.status, 200)
    return (await response.json()) as {
      readonly byteLength: number
      readonly key: string
      readonly sha256: string
    }
  }

  const catalogueBytes = new TextEncoder().encode(
    JSON.stringify({ facts: [{ id: 'fact-1', value: 'Reviewed truth' }] })
  )
  const russianCatalogueBytes = new TextEncoder().encode(
    JSON.stringify({ facts: [{ id: 'fact-1', value: 'Проверенный факт' }] })
  )
  const assetBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
  const catalogueObject = await putObject(catalogueBytes)
  const russianCatalogueObject = await putObject(russianCatalogueBytes)
  const assetObject = await putObject(assetBytes)
  const manifestBytes = new TextEncoder().encode(
    JSON.stringify({
      assets: [assetObject.sha256],
      catalogues: [catalogueObject.sha256, russianCatalogueObject.sha256],
      releaseId: 'facts-release-integration-1',
    })
  )
  const manifestObject = await putObject(manifestBytes)

  const registration = {
    assets: [
      {
        assetId: 'portrait',
        byteLength: assetObject.byteLength,
        fileName: 'portrait.png',
        mediaType: 'image/png',
        objectKey: assetObject.key,
        releaseId: 'facts-release-integration-1',
        sha256: assetObject.sha256,
      },
    ],
    catalogs: [
      {
        byteLength: catalogueObject.byteLength,
        locale: 'en',
        mediaType: 'application/json',
        objectKey: catalogueObject.key,
        releaseId: 'facts-release-integration-1',
        sha256: catalogueObject.sha256,
      },
      {
        byteLength: russianCatalogueObject.byteLength,
        locale: 'ru',
        mediaType: 'application/json',
        objectKey: russianCatalogueObject.key,
        releaseId: 'facts-release-integration-1',
        sha256: russianCatalogueObject.sha256,
      },
    ],
    release: {
      compilerCommit: 'compiler-commit-1',
      compilerRepository: 'https://example.test/cv',
      createdAt: '2026-07-17T12:00:00.000Z',
      factsSchemaVersion: 'cv-facts/v1',
      id: 'facts-release-integration-1',
      manifestByteLength: manifestObject.byteLength,
      manifestObjectKey: manifestObject.key,
      manifestSha256: manifestObject.sha256,
      sourceCommit: 'facts-commit-1',
      sourceRepository: 'https://example.test/cv-content',
    },
  }

  const register = await harness.fetchRegistry(
    '/v1/facts-releases',
    jsonRequest(registration)
  )
  assert.equal(register.status, 200)
  assert.deepEqual(await register.json(), registration)

  const replay = await harness.fetchRegistry(
    '/v1/facts-releases',
    jsonRequest(registration)
  )
  assert.equal(replay.status, 200)
  assert.deepEqual(await replay.json(), registration)

  const activate = await harness.fetchRegistry(
    '/v1/facts-releases/channels/production',
    jsonRequest(
      { expectedVersion: 0, releaseId: registration.release.id },
      'PUT'
    )
  )
  assert.equal(activate.status, 200)
  const channel = (await activate.json()) as {
    readonly activeReleaseId: string
    readonly version: number
  }
  assert.equal(channel.activeReleaseId, registration.release.id)
  assert.equal(channel.version, 1)

  const active = await harness.fetchRegistry(
    '/v1/facts-releases/active?locale=en'
  )
  assert.equal(active.status, 200)
  const activeBody = (await active.json()) as {
    readonly assets: readonly { readonly data: string }[]
    readonly catalogue: { readonly data: string }
    readonly locales: readonly string[]
    readonly release: { readonly id: string }
  }
  assert.equal(activeBody.release.id, registration.release.id)
  assert.deepEqual(activeBody.locales, ['en', 'ru'])
  assert.deepEqual(
    Buffer.from(activeBody.catalogue.data, 'base64'),
    Buffer.from(catalogueBytes)
  )
  assert.deepEqual(
    Buffer.from(activeBody.assets[0]?.data ?? '', 'base64'),
    Buffer.from(assetBytes)
  )

  const russianActive = await harness.fetchRegistry(
    '/v1/facts-releases/active?locale=ru'
  )
  assert.equal(russianActive.status, 200)
  const russianActiveBody = (await russianActive.json()) as {
    readonly catalogue: { readonly data: string }
    readonly locales: readonly string[]
  }
  assert.deepEqual(russianActiveBody.locales, ['en', 'ru'])
  assert.deepEqual(
    Buffer.from(russianActiveBody.catalogue.data, 'base64'),
    Buffer.from(russianCatalogueBytes)
  )

  const staleActivation = await harness.fetchRegistry(
    '/v1/facts-releases/channels/production',
    jsonRequest(
      { expectedVersion: 0, releaseId: registration.release.id },
      'PUT'
    )
  )
  assert.equal(staleActivation.status, 409)
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

test('persists opaque tailored content from job snapshot through publication and PDF job dispatch', async () => {
  const encode = (value: string | Uint8Array) =>
    Buffer.from(value).toString('base64')
  const jsonRequest = (body: unknown, method = 'POST') => ({
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method,
  })

  const createdResponse = await harness.fetchRegistry('/v1/applications', {
    ...jsonRequest(applicationInput, 'PUT'),
  })
  assert.equal(createdResponse.status, 200)
  const application = (await createdResponse.json()) as {
    readonly id: string
    readonly version: number
  }

  const rawPosting = '<html><body>Opaque job posting</body></html>'
  const normalizedPosting = JSON.stringify({
    responsibilities: ['Build reliable systems'],
    title: 'Integration Engineer',
  })
  const snapshotResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/job-snapshots`,
    jsonRequest({
      fetcherVersion: 'integration-fetcher-v1',
      finalUrl: applicationInput.canonicalUrl,
      normalized: {
        data: encode(normalizedPosting),
        mediaType: 'application/json',
      },
      raw: {
        data: encode(rawPosting),
        mediaType: 'text/html',
      },
      requestedUrl: applicationInput.canonicalUrl,
      status: 'fetched',
    })
  )
  assert.equal(snapshotResponse.status, 200)
  const snapshot = (await snapshotResponse.json()) as {
    readonly id: string
  }

  const rawPayloadResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/job-snapshots/${snapshot.id}/payloads/raw`
  )
  assert.equal(rawPayloadResponse.status, 200)
  assert.deepEqual(await rawPayloadResponse.json(), {
    data: encode(rawPosting),
    mediaType: 'text/html',
  })

  const cvEntryResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/content-entries`,
    jsonRequest({ kind: 'cv', locale: 'en' })
  )
  assert.equal(cvEntryResponse.status, 200)
  const cvEntry = (await cvEntryResponse.json()) as {
    readonly id: string
    readonly version: number
  }
  assert.equal(cvEntry.version, 1)

  const documentBytes = new TextEncoder().encode(
    JSON.stringify({
      arbitraryFutureField: { remainsOpaqueToRegistry: true },
      heading: 'Tailored CV',
    })
  )
  const appendResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/content-entries/${cvEntry.id}/revisions`,
    jsonRequest({
      contractId: 'cv-document',
      contractVersion: '1',
      expectedVersion: cvEntry.version,
      factsReleaseId: null,
      jobSnapshotId: snapshot.id,
      operationId: 'integration-cv-draft-1',
      payload: {
        data: encode(documentBytes),
        mediaType: 'application/json',
      },
      source: 'ai',
    })
  )
  assert.equal(appendResponse.status, 200)
  const appended = (await appendResponse.json()) as {
    readonly entry: { readonly version: number }
    readonly revision: { readonly id: string }
  }
  assert.equal(appended.entry.version, 2)

  const readRevisionResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/content-entries/${cvEntry.id}/revisions/${appended.revision.id}`
  )
  assert.equal(readRevisionResponse.status, 200)
  const readRevision = (await readRevisionResponse.json()) as {
    readonly payload: { readonly data: string; readonly mediaType: string }
  }
  assert.deepEqual(
    Buffer.from(readRevision.payload.data, 'base64'),
    Buffer.from(documentBytes)
  )
  assert.equal(readRevision.payload.mediaType, 'application/json')

  const approveResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/content-entries/${cvEntry.id}/approval`,
    jsonRequest({
      expectedVersion: appended.entry.version,
      revisionId: appended.revision.id,
    })
  )
  assert.equal(approveResponse.status, 200)
  const approved = (await approveResponse.json()) as {
    readonly entry: { readonly version: number }
  }
  assert.equal(approved.entry.version, 3)

  const publicationResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/content-entries/${cvEntry.id}/publication`,
    jsonRequest({
      expectedContentVersion: approved.entry.version,
      publicBaseUrl: 'https://cv.example.test/c',
    })
  )
  assert.equal(publicationResponse.status, 200)
  const publication = (await publicationResponse.json()) as {
    readonly publicationVersion: number
    readonly publicUrl: string
    readonly token: string
    readonly version: number
  }
  assert.equal(
    publication.publicUrl,
    `https://cv.example.test/c/${publication.token}`
  )
  assert.equal(publication.version, 1)
  assert.equal(publication.publicationVersion, 1)

  const startPdfResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/content-entries/${cvEntry.id}/pdf-jobs`,
    jsonRequest({
      expectedPublicationVersion: publication.publicationVersion,
      rendererVersion: 'renderer-integration-v1',
      requestId: 'integration-pdf-request-1',
    })
  )
  assert.equal(startPdfResponse.status, 200)
  const pendingJob = (await startPdfResponse.json()) as {
    readonly jobId: string
    readonly status: string
  }
  assert.equal(pendingJob.status, 'pending')

  const readJobResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/content-entries/${cvEntry.id}/pdf-jobs/${pendingJob.jobId}`
  )
  assert.equal(readJobResponse.status, 200)
  const storedJob = (await readJobResponse.json()) as {
    readonly jobId: string
    readonly status: string
  }
  assert.equal(storedJob.jobId, pendingJob.jobId)
  assert.equal(storedJob.status, 'pending')

  const coverLetterEntryResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/content-entries`,
    jsonRequest({ kind: 'cover_letter', locale: 'en' })
  )
  assert.equal(coverLetterEntryResponse.status, 200)
  const coverLetterEntry = (await coverLetterEntryResponse.json()) as {
    readonly id: string
    readonly version: number
  }
  const coverLetterResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/content-entries/${coverLetterEntry.id}/revisions`,
    jsonRequest({
      contractId: 'cover-letter',
      contractVersion: '1',
      expectedVersion: coverLetterEntry.version,
      operationId: 'integration-cover-letter-1',
      payload: {
        data: encode('Dear hiring team,\n\nOpaque cover letter.'),
        mediaType: 'text/plain',
      },
      source: 'human',
    })
  )
  assert.equal(coverLetterResponse.status, 200)

  const rejectResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}`,
    jsonRequest(
      {
        applicationStatus: 'rejected',
        expectedVersion: application.version,
      },
      'PATCH'
    )
  )
  assert.equal(rejectResponse.status, 200)
  const rejectedApplication = (await rejectResponse.json()) as {
    readonly applicationStatus: string
    readonly version: number
  }
  assert.equal(rejectedApplication.applicationStatus, 'rejected')

  const disabledResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/content-entries/${cvEntry.id}/publication`
  )
  assert.equal(disabledResponse.status, 200)
  const disabled = (await disabledResponse.json()) as {
    readonly enabled: boolean
    readonly token: string
  }
  assert.equal(disabled.enabled, false)
  assert.equal(disabled.token, publication.token)

  const reopenResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}`,
    jsonRequest(
      {
        applicationStatus: 'preparing',
        expectedVersion: rejectedApplication.version,
      },
      'PATCH'
    )
  )
  assert.equal(reopenResponse.status, 200)

  const reenabledResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/content-entries/${cvEntry.id}/publication`
  )
  assert.equal(reenabledResponse.status, 200)
  const reenabled = (await reenabledResponse.json()) as {
    readonly enabled: boolean
    readonly token: string
  }
  // Reopening cannot expose a publication until the queued worker has produced
  // a ready PDF for the pinned publication version.
  assert.equal(reenabled.enabled, false)
  assert.equal(reenabled.token, publication.token)
})

test('captures and refreshes an application job posting through the Worker', async () => {
  await harness.dispose()
  let outboundStatus = 200
  const requestedUrls: string[] = []
  harness = await RegistryWorkerHarness.makeWithOutboundService((request) => {
    requestedUrls.push(request.url)
    return new Response(
      outboundStatus === 200
        ? '<html><body><h1>Platform Engineer</h1></body></html>'
        : 'Posting temporarily unavailable',
      {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        status: outboundStatus,
      }
    )
  })

  const canonicalUrl = 'https://jobs.example.test/roles/platform-engineer'
  const createdResponse = await harness.fetchRegistry('/v1/applications', {
    body: JSON.stringify({
      ...applicationInput,
      canonicalUrl,
      jobKey: 'url:https://jobs.example.test/roles/platform-engineer',
      sourceJobId: 'platform-engineer',
    }),
    headers: { 'content-type': 'application/json' },
    method: 'PUT',
  })
  assert.equal(createdResponse.status, 200)
  const application = (await createdResponse.json()) as {
    readonly id: string
  }

  const capturedResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/job-snapshots/capture`,
    { method: 'POST' }
  )
  assert.equal(capturedResponse.status, 200)
  const captured = (await capturedResponse.json()) as {
    readonly errorCode: string | null
    readonly finalUrl: string | null
    readonly id: string
    readonly normalizedByteLength: number | null
    readonly normalizedMediaType: string | null
    readonly rawByteLength: number | null
    readonly rawMediaType: string | null
    readonly status: string
  }
  assert.equal(captured.status, 'fetched')
  assert.equal(captured.errorCode, null)
  assert.equal(captured.finalUrl, canonicalUrl)
  assert.equal(captured.rawMediaType, 'text/html; charset=utf-8')
  assert.ok((captured.rawByteLength ?? 0) > 0)
  assert.equal(captured.normalizedMediaType, 'text/plain; charset=utf-8')
  assert.ok((captured.normalizedByteLength ?? 0) > 0)

  const rawResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/job-snapshots/${captured.id}/payloads/raw`
  )
  assert.equal(rawResponse.status, 200)
  const raw = (await rawResponse.json()) as {
    readonly data: string
    readonly mediaType: string
  }
  assert.equal(
    Buffer.from(raw.data, 'base64').toString('utf8'),
    '<html><body><h1>Platform Engineer</h1></body></html>'
  )
  assert.equal(raw.mediaType, 'text/html; charset=utf-8')

  const normalizedResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/job-snapshots/${captured.id}/payloads/normalized`
  )
  assert.equal(normalizedResponse.status, 200)
  const normalized = (await normalizedResponse.json()) as {
    readonly data: string
    readonly mediaType: string
  }
  const normalizedText = Buffer.from(normalized.data, 'base64').toString('utf8')
  assert.equal(normalized.mediaType, 'text/plain; charset=utf-8')
  assert.match(normalizedText, /^# Normalized job posting/u)
  assert.match(normalizedText, /Source URL: https:\/\/jobs\.example\.test/u)
  assert.match(normalizedText, /Platform Engineer/u)

  outboundStatus = 503
  const failedResponse = await harness.fetchRegistry(
    `/v1/applications/${application.id}/job-snapshots/capture`,
    { method: 'POST' }
  )
  assert.equal(failedResponse.status, 200)
  const failed = (await failedResponse.json()) as {
    readonly errorCode: string | null
    readonly id: string
    readonly rawObjectKey: string | null
    readonly status: string
  }
  assert.equal(failed.status, 'failed')
  assert.equal(failed.errorCode, 'http_503')
  assert.ok(failed.rawObjectKey)
  assert.deepEqual(requestedUrls, [canonicalUrl, canonicalUrl])
})
