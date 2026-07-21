import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'

import {
  type ApplicationRegistryHttpClientService,
  makeApplicationRegistryHttpClient,
} from '@cv/application-registry-api-client'
import { Effect, Redacted } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import { applicationInput } from './fixtures'
import {
  type RegistryApiHarness,
  registryTestToken,
} from './support/registry-api'

const connect = async (
  harness: RegistryApiHarness
): Promise<ApplicationRegistryHttpClientService> =>
  Effect.runPromise(
    makeApplicationRegistryHttpClient({
      baseUrl: harness.url,
      token: Redacted.make(registryTestToken),
    }).pipe(Effect.provide(FetchHttpClient.layer))
  )

export const registerApplicationRegistryE2eTests = (
  getHarness: () => RegistryApiHarness
) => {
  test('serves the unversioned OpenAPI and protects registry resources', async () => {
    const harness = getHarness()
    const health = await fetch(new URL('/health', harness.url))
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { ok: true })

    const openApiResponse = await fetch(new URL('/openapi.json', harness.url))
    assert.equal(openApiResponse.status, 200)
    const openApi = (await openApiResponse.json()) as {
      readonly openapi: string
      readonly paths: Readonly<Record<string, unknown>>
    }
    assert.equal(openApi.openapi, '3.1.0')
    assert.ok(openApi.paths['/api/registry/applications'])
    assert.ok(openApi.paths['/api/registry/blobs/{sha256}'])
    assert.ok(openApi.paths['/api/registry/applications/{id}/activities'])
    assert.equal(
      Object.keys(openApi.paths).some((path) => path.startsWith('/v1')),
      false
    )

    const unauthorized = await fetch(
      new URL('/api/registry/applications', harness.url),
      { headers: { authorization: 'Bearer invalid-token' } }
    )
    assert.equal(unauthorized.status, 401)
    assert.equal(unauthorized.headers.get('cache-control'), 'private, no-store')

    const missingMachineCredential = await fetch(
      new URL('/machine/health', harness.url)
    )
    assert.equal(missingMachineCredential.status, 401)

    const machineHealth = await fetch(new URL('/machine/health', harness.url), {
      headers: { authorization: `Bearer ${registryTestToken}` },
    })
    assert.equal(machineHealth.status, 200)
    assert.deepEqual(await machineHealth.json(), { ok: true })
    assert.equal(
      machineHealth.headers.get('cache-control'),
      'private, no-store'
    )
  })

  test('creates, queries, updates, annotates, and replays through one resource API', async () => {
    const harness = getHarness()
    let registry = await connect(harness)
    const created = await Effect.runPromise(
      registry.applications.createApplication({ payload: applicationInput })
    )
    assert.match(created.id, /^[0-9a-f-]{36}$/u)
    assert.equal(created.postingUrl, applicationInput.postingUrl)
    assert.equal(created.version, 1)

    const duplicate = await Effect.runPromise(
      registry.applications
        .createApplication({ payload: applicationInput })
        .pipe(Effect.flip)
    )
    assert.equal(duplicate._tag, 'ConflictError')

    const listed = await Effect.runPromise(
      registry.applications.listApplications({
        query: {
          filters: [
            {
              type: 'condition',
              field: 'company',
              operator: 'contains',
              value: 'Example',
            },
            {
              type: 'condition',
              field: 'labels',
              operator: 'hasAny',
              value: ['e2e'],
            },
          ],
          orderBy: [{ field: 'company', direction: 'asc' }],
          pagination: { size: 10 },
        },
      })
    )
    assert.deepEqual(
      listed.items.map(({ id }) => id),
      [created.id]
    )

    const updateRequest = {
      headers: { 'idempotency-key': 'e2e-update-1' },
      params: { id: created.id },
      payload: {
        applicationStatus: 'applied' as const,
        expectedVersion: created.version,
        followUpAt: '2026-07-20T12:00:00.000Z',
        labels: ['e2e', 'follow-up'],
      },
    }
    const updated = await Effect.runPromise(
      registry.applications.updateApplication(updateRequest)
    )
    assert.equal(updated.application.applicationStatus, 'applied')
    assert.equal(updated.application.version, 2)
    assert.ok(updated.application.appliedAt)

    const replayed = await Effect.runPromise(
      registry.applications.updateApplication(updateRequest)
    )
    assert.deepEqual(replayed, updated)

    const noteResult = await Effect.runPromise(
      registry.applications.addApplicationNote({
        headers: { 'idempotency-key': 'e2e-note-1' },
        params: { id: created.id },
        payload: {
          body: 'Follow up after the application.',
          kind: 'general',
          source: 'e2e',
        },
      })
    )
    assert.equal(noteResult.replayed, false)

    const noteReplay = await Effect.runPromise(
      registry.applications.addApplicationNote({
        headers: { 'idempotency-key': 'e2e-note-1' },
        params: { id: created.id },
        payload: {
          body: 'Follow up after the application.',
          kind: 'general',
          source: 'e2e',
        },
      })
    )
    assert.equal(noteReplay.replayed, true)
    assert.equal(noteReplay.note.id, noteResult.note.id)

    const activities = await Effect.runPromise(
      registry.applications.listApplicationActivities({
        params: { id: created.id },
      })
    )
    assert.deepEqual(
      activities.items.map(({ kind }) => kind),
      ['application_created', 'status_changed', 'note_added']
    )

    const globalActivities = await Effect.runPromise(
      registry.applications.listActivities({
        query: {
          filters: [
            {
              type: 'condition',
              field: 'applicationId',
              operator: 'eq',
              value: created.id,
            },
          ],
          pagination: { size: 10 },
        },
      })
    )
    assert.equal(globalActivities.items.length, 3)

    await harness.restart()
    registry = await connect(harness)
    const persisted = await Effect.runPromise(
      registry.applications.getApplication({ params: { id: created.id } })
    )
    assert.equal(persisted.applicationStatus, 'applied')
    assert.equal(persisted.version, 3)
  })

  test('uploads and downloads opaque content without base64 JSON', async () => {
    const registry = await connect(getHarness())
    const bytes = new TextEncoder().encode('raw binary registry payload')
    const sha256 = createHash('sha256').update(bytes).digest('hex')

    const metadata = await Effect.runPromise(
      registry.content.putBlob({
        params: { sha256 },
        payload: bytes,
      })
    )
    assert.deepEqual(metadata, { byteLength: bytes.byteLength, sha256 })

    const downloaded = await Effect.runPromise(
      registry.content.getBlob({ params: { sha256 } })
    )
    assert.deepEqual(downloaded, bytes)

    const mismatch = await Effect.runPromise(
      registry.content
        .putBlob({
          params: { sha256: '0'.repeat(64) },
          payload: bytes,
        })
        .pipe(Effect.flip)
    )
    assert.equal(mismatch._tag, 'BadRequestError')
  })
}
