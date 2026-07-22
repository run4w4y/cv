import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  RegistryEventPublisher,
  RegistryEventSchema,
  RegistryEventSource,
} from '@cv/application-registry-events'
import {
  type StartedNatsTestContainer,
  startNatsTestContainer,
} from '@cv/test-infrastructure/nats'
import { Effect, Stream } from 'effect'

import {
  cvPdfTriggerSubjects,
  makeNatsRegistryEventPublisherLayer,
  makeNatsRegistryEventSourceLayer,
  makeRegistryEventConsumerConfiguration,
  makeRegistryEventPublisherConfiguration,
  makeRegistryEventTopology,
  registryEventWildcardSubject,
} from '../src'

let nats: StartedNatsTestContainer
const topology = makeRegistryEventTopology()
const publisherCredentials = {
  password: 'events-publisher-password',
  username: 'events-publisher',
}
const pdfWorkerCredentials = {
  password: 'pdf-worker-password',
  username: 'pdf-worker',
}

const connection = (
  clientName: string,
  credentials: { readonly password: string; readonly username: string } = nats
) => ({
  clientName,
  maxReconnectAttempts: 3,
  password: credentials.password,
  server: nats.server,
  username: credentials.username,
})

before(async () => {
  nats = await startNatsTestContainer({
    topology: {
      streams: [
        {
          consumers: ['registry-pdf-worker', 'events-integration-observer'].map(
            (durableName) => ({
              ackWaitMilliseconds: 120_000,
              durableName,
              filterSubjects: cvPdfTriggerSubjects(topology),
              maxAckPending: 1,
              maxDeliver: 5,
              maxWaiting: 4,
            })
          ),
          name: topology.streamName,
          subjects: [registryEventWildcardSubject(topology)],
        },
      ],
    },
    users: [
      {
        ...publisherCredentials,
        permissions: {
          publish: ['registry.events.>'],
          subscribe: ['_INBOX.>'],
        },
      },
      {
        ...pdfWorkerCredentials,
        permissions: {
          publish: [
            'registry.events.>',
            '$JS.API.CONSUMER.INFO.REGISTRY_EVENTS.registry-pdf-worker',
            '$JS.API.CONSUMER.MSG.NEXT.REGISTRY_EVENTS.registry-pdf-worker',
            '$JS.ACK.REGISTRY_EVENTS.registry-pdf-worker.>',
          ],
          subscribe: ['_INBOX.>'],
        },
      },
    ],
  })
})

after(async () => {
  await nats.dispose()
})

test('least-privilege clients publish and fan out to durable consumers', async () => {
  const event = RegistryEventSchema.cases.CvPublicationAvailabilityChanged.make(
    {
      applicationId: 'application-1',
      contentEntryId: 'entry-1',
      contentRevisionId: 'revision-1',
      correlationId: 'publish-1',
      cvLinkId: 'link-1',
      enabled: true,
      eventId: 'cv-publication-availability-changed:publish-1',
      occurredAt: '2026-07-21T12:00:00.000Z',
      publicationVersion: 1,
      version: 1,
    }
  )

  await Effect.runPromise(
    RegistryEventPublisher.use((publisher) => publisher.publish(event)).pipe(
      Effect.scoped,
      Effect.provide(
        makeNatsRegistryEventPublisherLayer(
          makeRegistryEventPublisherConfiguration({
            nats: connection(
              'events-integration-publisher',
              publisherCredentials
            ),
          })
        )
      )
    )
  )

  const consume = (
    consumerName: string,
    credentials?: { readonly password: string; readonly username: string }
  ) =>
    Effect.runPromise(
      RegistryEventSource.use((source) =>
        source.deliveries.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.flatMap((deliveries) => {
            const delivery = deliveries[0]
            return delivery === undefined
              ? Effect.die('Expected one registry event delivery.')
              : delivery.ack.pipe(Effect.as(delivery.event))
          })
        )
      ).pipe(
        Effect.scoped,
        Effect.provide(
          makeNatsRegistryEventSourceLayer(
            makeRegistryEventConsumerConfiguration({
              consumerName,
              nats: connection(consumerName, credentials),
              pullExpiresMilliseconds: 2_000,
            })
          )
        )
      )
    )

  const [first, second] = await Promise.all([
    consume('registry-pdf-worker', pdfWorkerCredentials),
    consume('events-integration-observer'),
  ])

  assert.deepEqual(first, event)
  assert.deepEqual(second, event)
})

test('publisher does not create a missing stream', async () => {
  const missingTopology = makeRegistryEventTopology({
    streamName: 'REGISTRY_EVENTS_MISSING',
    subjectRoot: 'registry.missing',
  })
  const event = RegistryEventSchema.cases.ApplicationCreated.make({
    applicationId: 'application-missing',
    correlationId: 'application-missing',
    eventId: 'application-created:application-missing',
    occurredAt: '2026-07-21T12:00:00.000Z',
    version: 1,
  })

  await assert.rejects(
    Effect.runPromise(
      RegistryEventPublisher.use((publisher) => publisher.publish(event)).pipe(
        Effect.scoped,
        Effect.provide(
          makeNatsRegistryEventPublisherLayer(
            makeRegistryEventPublisherConfiguration({
              nats: connection('events-integration-missing-publisher'),
              topology: missingTopology,
            })
          )
        )
      )
    ),
    /publish failed/u
  )
})

test('source does not create a missing durable consumer', async () => {
  await assert.rejects(
    Effect.runPromise(
      RegistryEventSource.use(() => Effect.void).pipe(
        Effect.scoped,
        Effect.provide(
          makeNatsRegistryEventSourceLayer(
            makeRegistryEventConsumerConfiguration({
              consumerName: 'events-integration-missing',
              nats: connection('events-integration-missing-consumer'),
              pullExpiresMilliseconds: 2_000,
            })
          )
        )
      )
    ),
    /consumer binding failed/u
  )
})
