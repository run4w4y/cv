import { describe, expect, test } from 'bun:test'
import type { AiProviderShape } from '@cv/ai-provider'
import type { ReadyPdfArtifactResponse } from '@cv/application-registry-api-contract'
import type { Application } from '@cv/application-registry-entity'
import { Effect } from 'effect'

import type { RegistryClient } from '../../lib/registry-client'
import { makePreparationContextRepository } from './repository/context'
import { makePreparationPublicationRepository } from './repository/publication'

const application: Application = {
  applicationStatus: 'not_started',
  appliedAt: null,
  canonicalUrl: 'https://example.test/jobs/one',
  company: 'Example',
  createdAt: '2026-07-16T09:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  jobKey: 'web:one',
  lastContactAt: null,
  listingAvailability: 'open',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  role: 'Staff Engineer',
  source: 'web',
  sourceJobId: 'one',
  targetStage: 'apply_next',
  updatedAt: '2026-07-16T09:00:00.000Z',
  updatedRevision: 1,
  version: 2,
}

const identity = {
  applicationId: application.id,
  kind: 'cv',
  locale: 'en',
} as const

const unusedAi = {
  discoverModels: () => Effect.succeed([]),
} as unknown as AiProviderShape

const contextRepository = (registry: object) =>
  makePreparationContextRepository(
    registry as RegistryClient['Service'],
    unusedAi,
    () => Effect.die('Content must not load before bootstrap prerequisites.')
  )

describe('preparation bootstrap lifecycle ordering', () => {
  test('does not capture context or create content when the lifecycle transition fails', async () => {
    const calls: Array<string> = []
    const repository = contextRepository({
      registry: {
        ensureContentEntry: () =>
          Effect.sync(() => calls.push('ensure-content')).pipe(
            Effect.andThen(Effect.die('unexpected content creation'))
          ),
        getActiveFactsRelease: () =>
          Effect.sync(() => calls.push('facts')).pipe(
            Effect.andThen(Effect.die('unexpected facts read'))
          ),
        getApplication: () =>
          Effect.sync(() => {
            calls.push('get-application')
            return application
          }),
        getLatestJobPostingSnapshot: () =>
          Effect.sync(() => calls.push('snapshot')).pipe(
            Effect.andThen(Effect.die('unexpected snapshot read'))
          ),
        patchApplication: () =>
          Effect.sync(() => calls.push('patch-application')).pipe(
            Effect.andThen(
              Effect.fail({
                _tag: 'InternalServerError' as const,
                message: 'Transition failed.',
              })
            )
          ),
      },
    })

    const result = await Effect.runPromise(
      Effect.result(repository.loadBootstrap(identity))
    )

    expect(result._tag).toBe('Failure')
    expect(calls).toEqual(['get-application', 'patch-application'])
  })

  test('settles an optimistic conflict before requesting preparation data', async () => {
    const calls: Array<string> = []
    const patchInputs: Array<{
      readonly payload: { expectedVersion: number }
    }> = []
    let applicationReads = 0
    let patchAttempts = 0
    const unavailable = (name: string) =>
      Effect.sync(() => calls.push(name)).pipe(
        Effect.andThen(
          Effect.fail({
            _tag: 'ServiceUnavailable' as const,
            message: 'Stop after ordering is observable.',
          })
        )
      )
    const repository = contextRepository({
      registry: {
        ensureContentEntry: () => unavailable('ensure-content'),
        getActiveFactsRelease: () => unavailable('facts'),
        getApplication: () =>
          Effect.sync(() => {
            calls.push('get-application')
            applicationReads += 1
            return {
              ...application,
              updatedRevision: applicationReads,
              version: application.version + applicationReads - 1,
            }
          }),
        getLatestJobPostingSnapshot: () => unavailable('snapshot'),
        patchApplication: (input: {
          readonly payload: { readonly expectedVersion: number }
        }) =>
          Effect.suspend(() => {
            calls.push('patch-application')
            patchInputs.push(input)
            patchAttempts += 1
            return patchAttempts === 1
              ? Effect.fail({
                  _tag: 'ConflictError' as const,
                  message: 'The application was updated elsewhere.',
                })
              : Effect.succeed({
                  ...application,
                  applicationStatus: 'preparing' as const,
                  updatedRevision: 4,
                  version: 4,
                })
          }),
      },
    })

    await Effect.runPromise(Effect.result(repository.loadBootstrap(identity)))

    expect(calls.slice(0, 4)).toEqual([
      'get-application',
      'patch-application',
      'get-application',
      'patch-application',
    ])
    expect(calls.slice(4).every((call) => !call.includes('application'))).toBe(
      true
    )
    expect(patchInputs.map(({ payload }) => payload.expectedVersion)).toEqual([
      2, 3,
    ])
  })

  test('does not rewrite an application whose preparation already started', async () => {
    const calls: Array<string> = []
    const unavailable = (name: string) =>
      Effect.sync(() => calls.push(name)).pipe(
        Effect.andThen(
          Effect.fail({
            _tag: 'ServiceUnavailable' as const,
            message: 'Stop after lifecycle inspection.',
          })
        )
      )
    const repository = contextRepository({
      registry: {
        ensureContentEntry: () => unavailable('ensure-content'),
        getActiveFactsRelease: () => unavailable('facts'),
        getApplication: () =>
          Effect.sync(() => {
            calls.push('get-application')
            return { ...application, applicationStatus: 'preparing' as const }
          }),
        getLatestJobPostingSnapshot: () => unavailable('snapshot'),
        patchApplication: () =>
          Effect.sync(() => calls.push('patch-application')).pipe(
            Effect.andThen(Effect.die('unexpected lifecycle rewrite'))
          ),
      },
    })

    await Effect.runPromise(Effect.result(repository.loadBootstrap(identity)))

    expect(calls[0]).toBe('get-application')
    expect(calls).not.toContain('patch-application')
  })

  test('does not bootstrap content when the transition response remains not started', async () => {
    const calls: Array<string> = []
    const repository = contextRepository({
      registry: {
        ensureContentEntry: () =>
          Effect.sync(() => calls.push('ensure-content')).pipe(
            Effect.andThen(Effect.die('unexpected content creation'))
          ),
        getActiveFactsRelease: () =>
          Effect.sync(() => calls.push('facts')).pipe(
            Effect.andThen(Effect.die('unexpected facts read'))
          ),
        getApplication: () =>
          Effect.sync(() => {
            calls.push('get-application')
            return application
          }),
        getLatestJobPostingSnapshot: () =>
          Effect.sync(() => calls.push('snapshot')).pipe(
            Effect.andThen(Effect.die('unexpected snapshot read'))
          ),
        patchApplication: () =>
          Effect.sync(() => {
            calls.push('patch-application')
            return application
          }),
      },
    })

    const result = await Effect.runPromise(
      Effect.result(repository.loadBootstrap(identity))
    )

    expect(result._tag).toBe('Failure')
    expect(calls).toEqual([
      'get-application',
      'patch-application',
      'get-application',
      'patch-application',
      'get-application',
      'patch-application',
    ])
  })
})

describe('preserved PDF reads', () => {
  test('falls back to the exact-publication artifact after a renderer upgrade', async () => {
    const queries: Array<{ readonly rendererVersion?: string }> = []
    const response = {
      artifact: {
        byteLength: 8,
        contentRevisionId: 'revision-1',
        createdAt: '2026-07-17T10:00:00.000Z',
        cvLinkId: 'link-1',
        errorCode: null,
        errorMessage: null,
        generatedAt: '2026-07-17T10:01:00.000Z',
        id: 'artifact-1',
        kind: 'pdf',
        mediaType: 'application/pdf',
        objectKey: 'sha256/pdf',
        publicationVersion: 1,
        qrTarget: 'https://cv.example.test/c/token',
        rendererVersion: 'renderer-v1',
        sha256: 'a'.repeat(64),
        status: 'ready',
        updatedAt: '2026-07-17T10:01:00.000Z',
        requestId: 'request-1',
      },
      payload: { data: 'JVBERg==', mediaType: 'application/pdf' },
    } as ReadyPdfArtifactResponse
    const repository = makePreparationPublicationRepository({
      registry: {
        readCurrentPdfArtifact: (input: {
          readonly query: { readonly rendererVersion?: string }
        }) =>
          Effect.suspend(() => {
            queries.push(input.query)
            return input.query.rendererVersion === undefined
              ? Effect.succeed(response)
              : Effect.fail({
                  _tag: 'NotFoundError' as const,
                  message: 'No artifact exists for this renderer.',
                })
          }),
      },
    } as unknown as RegistryClient['Service'])

    const result = await Effect.runPromise(
      repository.readCurrentPdf({
        applicationId: application.id,
        entryId: 'entry-1',
        rendererVersion: 'renderer-v2',
      })
    )

    expect(result.artifact.rendererVersion).toBe('renderer-v1')
    expect(queries).toEqual([{ rendererVersion: 'renderer-v2' }, {}])
  })
})
