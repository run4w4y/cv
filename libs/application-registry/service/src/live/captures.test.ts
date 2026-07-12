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
  operationLayer = operationsCrudLayer()
) =>
  CapturesServiceLive.pipe(
    Layer.provide(applicationsCrudLayer()),
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
})
