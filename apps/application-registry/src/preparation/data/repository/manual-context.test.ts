import { describe, expect, test } from 'bun:test'
import type { Application } from '@cv/application-registry-entity'
import { Crypto, Effect } from 'effect'

import type { RegistryClient } from '@/lib/registry-client'
import { makeManualJobContextRepository } from './manual-context'

const application = {
  id: 'application-1',
  postingUrl: 'https://example.test/jobs/one',
  updatedAt: '2026-07-16T09:00:00.000Z',
} as Application

const testCrypto = Crypto.make({
  digest: () => Effect.succeed(new Uint8Array(32).fill(1)),
  randomBytes: (size) => new Uint8Array(size),
})

describe('manual job context repository', () => {
  test('uploads context bytes before persisting the blob reference', async () => {
    let uploaded: Uint8Array | undefined
    let persisted: unknown
    const snapshot = {
      applicationId: application.id,
      errorCode: null,
      errorMessage: null,
      fetchedAt: application.updatedAt,
      fetcherVersion: 'application-registry-management-job-context/v1',
      finalUrl: application.postingUrl,
      id: 'snapshot-1',
      normalizedByteLength: 7,
      normalizedMediaType: 'text/plain; charset=utf-8',
      normalizedObjectKey: 'blob',
      normalizedSha256: 'hash',
      rawByteLength: null,
      rawMediaType: null,
      rawObjectKey: null,
      rawSha256: null,
      requestedUrl: application.postingUrl,
      status: 'provided' as const,
    }
    const repository = makeManualJobContextRepository(
      {
        applications: { getApplication: () => Effect.succeed(application) },
        content: {
          getLatestJobPostingSnapshot: () =>
            Effect.fail({ _tag: 'NotFoundError' as const, message: 'missing' }),
          persistJobPostingSnapshot: ({ payload }: { payload: unknown }) =>
            Effect.sync(() => {
              persisted = payload
              return snapshot
            }),
          putBlob: ({ payload }: { payload: Uint8Array }) =>
            Effect.sync(() => {
              uploaded = payload
              return { byteLength: payload.byteLength, sha256: 'hash' }
            }),
        },
      } as unknown as RegistryClient['Service'],
      testCrypto
    )

    const result = await Effect.runPromise(
      repository.persistManualJobContext({
        applicationId: application.id,
        value: ' revised context ',
      })
    )

    expect(new TextDecoder().decode(uploaded)).toBe('revised context')
    expect(persisted).toMatchObject({
      normalized: {
        mediaType: 'text/plain; charset=utf-8',
        sha256: expect.any(String),
      },
      status: 'provided',
    })
    expect(result).toEqual(snapshot)
  })
})
