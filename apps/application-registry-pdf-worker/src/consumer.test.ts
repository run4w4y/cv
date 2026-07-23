import { describe, expect, test } from 'bun:test'
import type { GeneratedArtifact } from '@cv/application-registry-entity'
import {
  type RegistryEvent,
  type RegistryEventDelivery,
  RegistryEventSchema,
  RegistryEventSourceError,
} from '@cv/application-registry-events'
import {
  PdfArtifactPersistence,
  PdfGenerationTransientError,
  PdfRenderer,
} from '@cv/application-registry-pdf-processing'
import type { PdfGenerationAttempt } from '@cv/application-registry-service'
import { Effect, Layer } from 'effect'

import { consumeRegistryEvent } from './consumer'

const occurredAt = '2026-07-21T12:00:00.000Z'
const trigger = RegistryEventSchema.cases.PdfGenerationRequested.make({
  applicationId: 'application-1',
  contentEntryId: 'entry-1',
  contentRevisionId: 'revision-1',
  correlationId: 'request-1',
  cvLinkId: 'link-1',
  eventId: 'pdf-generation-requested:request-1',
  occurredAt,
  publicationVersion: 1,
  version: 1,
})

const artifact: GeneratedArtifact = {
  byteLength: null,
  contentRevisionId: trigger.contentRevisionId,
  createdAt: occurredAt,
  cvLinkId: trigger.cvLinkId,
  errorCode: null,
  errorMessage: null,
  generatedAt: null,
  id: 'artifact-1',
  kind: 'pdf',
  mediaType: null,
  objectKey: null,
  publicationVersion: trigger.publicationVersion,
  qrTarget: 'https://cv.example.test/c/token-1',
  rendererVersion: 'pending:cv-application',
  requestId: trigger.eventId,
  sha256: null,
  status: 'pending',
  updatedAt: occurredAt,
}

const attempt: PdfGenerationAttempt = {
  artifact,
  entry: {
    applicationId: trigger.applicationId,
    approvedRevisionId: trigger.contentRevisionId,
    createdAt: occurredAt,
    headRevisionId: trigger.contentRevisionId,
    id: trigger.contentEntryId,
    kind: 'cv',
    locale: 'en',
    state: 'approved',
    updatedAt: occurredAt,
    version: 3,
  },
  link: {
    applicationId: trigger.applicationId,
    contentEntryId: trigger.contentEntryId,
    createdAt: occurredAt,
    currentRevisionId: trigger.contentRevisionId,
    disabledAt: null,
    disabledReason: null,
    enabled: true,
    id: trigger.cvLinkId,
    previewToken: 'preview-1',
    publicationVersion: trigger.publicationVersion,
    publicUrl: artifact.qrTarget,
    token: 'token-1',
    updatedAt: occurredAt,
    version: 2,
  },
  revision: {
    byteLength: 128,
    contentEntryId: trigger.contentEntryId,
    contractId: 'cv.document',
    contractVersion: '1',
    createdAt: occurredAt,
    factsReleaseId: null,
    id: trigger.contentRevisionId,
    jobSnapshotId: null,
    mediaType: 'application/json',
    objectKey: 'objects/revision-1',
    operationId: 'revision-operation-1',
    parentRevisionId: null,
    revisionNumber: 1,
    sha256: 'a'.repeat(64),
    source: 'human',
  },
}

const deliveryProbe = (
  event: RegistryEvent,
  deliveryCount = 1,
  working?: RegistryEventDelivery['working']
) => {
  const acknowledgements: string[] = []
  const delivery: RegistryEventDelivery = {
    ack: Effect.sync(() => {
      acknowledgements.push('ack')
    }),
    deliveryCount,
    event,
    nak: (milliseconds) =>
      Effect.sync(() => {
        acknowledgements.push(`nak:${milliseconds}`)
      }),
    sequence: 1,
    term: (reason) =>
      Effect.sync(() => {
        acknowledgements.push(`term:${reason}`)
      }),
    working:
      working ??
      Effect.sync(() => {
        acknowledgements.push('working')
      }),
  }
  return { acknowledgements, delivery }
}

const processingLayer = (
  render: PdfRenderer['Service']['render'],
  fail: PdfArtifactPersistence['Service']['fail'] = () =>
    Effect.succeed({
      ...artifact,
      errorCode: 'pdf_generation_invalid',
      errorMessage: 'failed',
      status: 'failed',
    })
) =>
  Layer.merge(
    Layer.succeed(
      PdfArtifactPersistence,
      PdfArtifactPersistence.of({
        complete: () =>
          Effect.succeed({
            ...artifact,
            byteLength: 4,
            generatedAt: occurredAt,
            mediaType: 'application/pdf',
            objectKey: 'objects/pdf-1',
            rendererVersion: 'chromium-test',
            sha256: 'b'.repeat(64),
            status: 'ready',
          }),
        ensure: () => Effect.succeed(attempt),
        fail,
      })
    ),
    Layer.succeed(PdfRenderer, PdfRenderer.of({ render }))
  )

describe('PDF registry-event consumer', () => {
  test('acknowledges unrelated registry events without invoking PDF services', async () => {
    const event = RegistryEventSchema.cases.CvPublicationChanged.make({
      applicationId: 'application-1',
      correlationId: 'application-1',
      eventId: 'cv-publication-changed:application-1',
      occurredAt,
      version: 1,
    })
    const probe = deliveryProbe(event)

    await Effect.runPromise(
      consumeRegistryEvent(probe.delivery, 30_000, 5).pipe(
        Effect.provide(
          processingLayer(() =>
            Effect.die('PDF services must not run for unrelated events.')
          )
        )
      )
    )

    expect(probe.acknowledgements).toEqual(['ack'])
  })

  test('renders a generation event and acknowledges only after persistence', async () => {
    const renderedUrls: string[] = []
    const probe = deliveryProbe(trigger)

    await Effect.runPromise(
      consumeRegistryEvent(probe.delivery, 30_000, 5).pipe(
        Effect.provide(
          processingLayer((url) =>
            Effect.sync(() => {
              renderedUrls.push(url)
              return {
                bytes: new Uint8Array([1, 2, 3, 4]),
                rendererVersion: 'chromium-test',
              }
            })
          )
        )
      )
    )

    expect(renderedUrls).toEqual([
      'https://cv.example.test/c/_preview/token-1?access=preview-1',
    ])
    expect(probe.acknowledgements).toEqual(['ack'])
  })

  test('negatively acknowledges transient rendering failures', async () => {
    const probe = deliveryProbe(trigger)

    await Effect.runPromise(
      consumeRegistryEvent(probe.delivery, 30_000, 5).pipe(
        Effect.provide(
          processingLayer(() =>
            Effect.fail(
              new PdfGenerationTransientError({
                cause: new Error('Chromium unavailable'),
                code: 'pdf_render_failed',
                message: 'Chromium unavailable',
              })
            )
          )
        )
      )
    )

    expect(probe.acknowledgements).toEqual(['nak:20000'])
  })

  test('interrupts processing when the delivery heartbeat fails', async () => {
    const probe = deliveryProbe(
      trigger,
      1,
      Effect.fail(
        new RegistryEventSourceError({
          cause: new Error('connection closed'),
          message: 'Registry event source message heartbeat failed.',
          operation: 'message heartbeat',
        })
      )
    )

    const error = await Effect.runPromise(
      consumeRegistryEvent(probe.delivery, 0, 5).pipe(
        Effect.provide(processingLayer(() => Effect.never)),
        Effect.flip
      )
    )

    expect(error).toBeInstanceOf(RegistryEventSourceError)
    expect(error.operation).toBe('message heartbeat')
    expect(probe.acknowledgements).toEqual([])
  })
})
