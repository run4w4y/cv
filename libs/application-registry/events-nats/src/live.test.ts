import { describe, expect, test } from 'bun:test'
import {
  publishRegistryEventBestEffort,
  RegistryEventPublisher,
  RegistryEventSchema,
} from '@cv/application-registry-events'
import { Effect } from 'effect'

import { makeNatsRegistryEventPublisherLayer } from './live'
import { makeRegistryEventPublisherConfiguration } from './model'

const configuration = makeRegistryEventPublisherConfiguration({
  nats: {
    clientName: 'lazy-publisher-test',
    maxReconnectAttempts: 0,
    password: 'password',
    server: 'nats://127.0.0.1:4222',
    username: 'username',
  },
})

const publicationChanged = RegistryEventSchema.cases.CvPublicationChanged.make({
  applicationId: 'application-1',
  correlationId: 'publication-1',
  eventId: 'cv-publication-changed:publication-1',
  occurredAt: '2026-07-23T12:00:00.000Z',
  version: 1,
})

const pdfRequested = RegistryEventSchema.cases.PdfGenerationRequested.make({
  applicationId: 'application-1',
  contentEntryId: 'entry-1',
  contentRevisionId: 'revision-1',
  correlationId: 'pdf-1',
  cvLinkId: 'link-1',
  eventId: 'pdf-generation-requested:pdf-1',
  occurredAt: '2026-07-23T12:00:00.000Z',
  publicationVersion: 1,
  version: 1,
})

describe('NATS registry event publisher', () => {
  test('defers connection acquisition and keeps only explicit commands strict', async () => {
    let connectionAttempts = 0
    const layer = makeNatsRegistryEventPublisherLayer(configuration, {
      connect: async () => {
        connectionAttempts += 1
        throw new Error('NATS unavailable')
      },
    })

    await Effect.runPromise(
      RegistryEventPublisher.use(() => Effect.void).pipe(Effect.provide(layer))
    )
    expect(connectionAttempts).toBe(0)

    await Effect.runPromise(
      RegistryEventPublisher.use((publisher) =>
        publishRegistryEventBestEffort(publisher, publicationChanged)
      ).pipe(Effect.provide(layer))
    )
    expect(connectionAttempts).toBe(1)

    const failure = await Effect.runPromise(
      RegistryEventPublisher.use((publisher) =>
        Effect.flip(publisher.publish(pdfRequested))
      ).pipe(Effect.provide(layer))
    )
    expect(connectionAttempts).toBe(2)
    expect(failure._tag).toBe('RegistryEventPublishError')
    expect(failure.eventId).toBe(pdfRequested.eventId)
  })
})
