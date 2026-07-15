import { describe, expect, test } from 'bun:test'
import type { PersistedCapture } from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'
import { application, capture, receipt } from '../../test/support/fixtures'
import {
  applicationsCrudLayer,
  capturesCrudLayer,
  operationsCrudLayer,
} from '../../test/support/layers'
import { operationRequestSignature } from '../internal/operation-request-signature'
import { CapturesService } from '../services/captures'
import type { CreateCampaignCaptureInput } from '../types'
import { CapturesServiceLive } from './captures'

const request: CreateCampaignCaptureInput = {
  applicationStatus: application.applicationStatus,
  applicationUrl: capture.applicationUrl,
  artifacts: capture.artifacts,
  audience: capture.audience,
  campaignRunId: capture.campaignRunId,
  canonicalUrl: application.canonicalUrl,
  capturedAt: capture.capturedAt,
  company: application.company,
  confidence: capture.confidence,
  deviceId: null,
  jobContentHash: capture.jobContentHash,
  jobKey: application.jobKey,
  location: application.location,
  operationId: capture.operationId,
  profile: capture.profile,
  role: application.role,
  source: application.source,
  sourceJobId: application.sourceJobId,
  submissionDetails: capture.submissionDetails,
  targetStage: application.targetStage,
}

const captureReceipt = (captureId = capture.id) =>
  receipt({
    captureId,
    kind: 'campaign_capture',
    noteId: null,
    operationId: request.operationId,
    operationRequestSignature: operationRequestSignature(
      'campaign_capture',
      request
    ),
  })

const live = (
  captureLayer = capturesCrudLayer(),
  operationLayer = operationsCrudLayer(),
  applicationLayer = applicationsCrudLayer()
) =>
  CapturesServiceLive.pipe(
    Layer.provide(applicationLayer),
    Layer.provide(captureLayer),
    Layer.provide(operationLayer)
  )

describe('CapturesService', () => {
  test('persists and reloads a fresh capture', async () => {
    let persisted: PersistedCapture | undefined
    let stored = false
    const result = await Effect.runPromise(
      CapturesService.use((service) => service.capture(request)).pipe(
        Effect.provide(
          live(
            capturesCrudLayer({
              findByOperation: () => Effect.succeed(capture),
              persist: (input) => {
                persisted = input
                stored = true
                return Effect.void
              },
            }),
            operationsCrudLayer({
              find: () =>
                Effect.succeed(
                  stored ? captureReceipt(persisted?.captureId) : undefined
                ),
            })
          )
        )
      )
    )

    expect(result).toEqual({ application, capture, replayed: false })
    expect(persisted?.applicationId).toBe(application.id)
    expect(persisted?.captureId).toMatch(/^[\da-f-]{36}$/u)
    expect(persisted?.eventId).toMatch(/^[\da-f-]{36}$/u)
  })

  test('replays a capture without allocating or writing', async () => {
    let wrote = false
    const result = await Effect.runPromise(
      CapturesService.use((service) => service.capture(request)).pipe(
        Effect.provide(
          live(
            capturesCrudLayer({
              findByOperation: () => Effect.succeed(capture),
              persist: () => {
                wrote = true
                return Effect.void
              },
            }),
            operationsCrudLayer({
              find: () => Effect.succeed(captureReceipt()),
            })
          )
        )
      )
    )

    expect(result.replayed).toBe(true)
    expect(wrote).toBe(false)
  })

  test('requires an explicit resolution for a canonical URL conflict', async () => {
    const conflict = {
      ...request,
      jobKey: 'url:https://example.test/jobs/one',
    }
    const error = await Effect.runPromise(
      CapturesService.use((service) => service.capture(conflict)).pipe(
        Effect.flip,
        Effect.provide(
          live(
            capturesCrudLayer(),
            operationsCrudLayer(),
            applicationsCrudLayer({
              findByCanonicalUrl: () => Effect.succeed([application]),
              findByJobKey: () => Effect.succeed(undefined),
            })
          )
        )
      )
    )

    expect(error._tag).toBe('RegistryConflictError')
  })

  test.each([
    'merge',
    'replace',
  ] as const)('%s resolves the conflict onto the selected application', async (strategy) => {
    let persisted: PersistedCapture | undefined
    let stored = false
    const incomingJobKey = 'url:https://example.test/jobs/one'
    const resolvedRequest: CreateCampaignCaptureInput = {
      ...request,
      identityResolution: {
        applicationId: application.id,
        expectedVersion: application.version,
        strategy,
      },
      jobKey: incomingJobKey,
    }
    await Effect.runPromise(
      CapturesService.use((service) => service.capture(resolvedRequest)).pipe(
        Effect.provide(
          live(
            capturesCrudLayer({
              findByOperation: () => Effect.succeed(capture),
              persist: (input) => {
                persisted = input
                stored = true
                return Effect.void
              },
            }),
            operationsCrudLayer({
              find: () =>
                Effect.succeed(
                  stored
                    ? receipt({
                        applicationId: application.id,
                        captureId: persisted?.captureId ?? null,
                        kind: 'campaign_capture',
                        operationId: resolvedRequest.operationId,
                        operationRequestSignature: operationRequestSignature(
                          'campaign_capture',
                          resolvedRequest
                        ),
                      })
                    : undefined
                ),
            }),
            applicationsCrudLayer({
              findByCanonicalUrl: () => Effect.succeed([application]),
              findByJobKey: () => Effect.succeed(undefined),
            })
          )
        )
      )
    )

    expect(persisted).toMatchObject({
      applicationId: application.id,
      identityAlias: incomingJobKey,
      jobKey: application.jobKey,
      writeMode: strategy === 'replace' ? 'replace' : 'capture',
    })
  })

  test('keep-both creates an explicitly distinct application', async () => {
    let persisted: PersistedCapture | undefined
    let stored = false
    const resolvedRequest: CreateCampaignCaptureInput = {
      ...request,
      identityResolution: {
        reason: 'The roles are genuinely distinct.',
        strategy: 'keep-both',
      },
      jobKey: 'url:https://example.test/jobs/one',
    }

    await Effect.runPromise(
      CapturesService.use((service) => service.capture(resolvedRequest)).pipe(
        Effect.provide(
          live(
            capturesCrudLayer({
              findByOperation: () => Effect.succeed(capture),
              persist: (input) => {
                persisted = input
                stored = true
                return Effect.void
              },
            }),
            operationsCrudLayer({
              find: () =>
                Effect.succeed(
                  stored
                    ? receipt({
                        applicationId:
                          persisted?.applicationId ?? application.id,
                        captureId: persisted?.captureId ?? null,
                        kind: 'campaign_capture',
                        operationId: resolvedRequest.operationId,
                        operationRequestSignature: operationRequestSignature(
                          'campaign_capture',
                          resolvedRequest
                        ),
                      })
                    : undefined
                ),
            }),
            applicationsCrudLayer({
              findByCanonicalUrl: () => Effect.succeed([application]),
              findByJobKey: () => Effect.succeed(undefined),
            })
          )
        )
      )
    )

    expect(persisted?.applicationId).not.toBe(application.id)
    expect(persisted).toMatchObject({
      identityAlias: undefined,
      jobKey: resolvedRequest.jobKey,
      writeMode: 'capture',
    })
  })
})
