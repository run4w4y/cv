import {
  AckPolicy,
  type ConsumerConfig,
  DeliverPolicy,
  DiscardPolicy,
  JetStreamApiCodes,
  JetStreamApiError,
  type JsMsg,
  jetstream,
  jetstreamManager,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  type StreamConfig,
} from '@nats-io/jetstream'
import { connect } from '@nats-io/transport-node'
import { Effect, Layer, Option, Predicate } from 'effect'

import { encodePdfQueueMessage } from './codec'
import {
  PdfQueue,
  type PdfQueueConfiguration,
  PdfQueueError,
  type PdfQueueMessage,
} from './model'

const nanoseconds = (milliseconds: number) => milliseconds * 1_000_000

const messageOf = (cause: unknown): string =>
  Predicate.isError(cause) ? cause.message : String(cause)

const queueError = (operation: string, cause: unknown) =>
  new PdfQueueError({
    cause,
    message: `PDF queue ${operation} failed: ${messageOf(cause)}`,
    operation,
  })

const streamConfiguration = (
  configuration: PdfQueueConfiguration
): Partial<StreamConfig> & Pick<StreamConfig, 'name'> => ({
  description: 'Durable PDF generation jobs owned by the CV application.',
  discard: DiscardPolicy.Old,
  duplicate_window: nanoseconds(configuration.duplicateWindowMilliseconds),
  max_age: nanoseconds(configuration.messageMaxAgeMilliseconds),
  max_bytes: configuration.maxStreamBytes,
  max_consumers: 1,
  max_msg_size: configuration.maxMessageBytes,
  max_msgs: configuration.maxMessages,
  max_msgs_per_subject: -1,
  name: configuration.streamName,
  num_replicas: 1,
  retention: RetentionPolicy.Workqueue,
  storage: StorageType.File,
  subjects: [configuration.subject],
})

const consumerConfiguration = (
  configuration: PdfQueueConfiguration
): Partial<ConsumerConfig> => ({
  ack_policy: AckPolicy.Explicit,
  ack_wait: nanoseconds(configuration.ackWaitMilliseconds),
  deliver_policy: DeliverPolicy.All,
  description: 'Single-message pull consumer for the self-hosted PDF runner.',
  durable_name: configuration.consumerName,
  filter_subject: configuration.subject,
  max_ack_pending: 1,
  max_deliver: configuration.maxDeliver,
  max_waiting: 4,
  name: configuration.consumerName,
  replay_policy: ReplayPolicy.Instant,
})

const assertExistingStream = (
  configuration: PdfQueueConfiguration,
  existing: StreamConfig
) => {
  const subjectMatches =
    existing.subjects.length === 1 &&
    existing.subjects[0] === configuration.subject
  if (
    !subjectMatches ||
    existing.retention !== RetentionPolicy.Workqueue ||
    existing.storage !== StorageType.File
  ) {
    throw new Error(
      `JetStream stream ${configuration.streamName} exists with an incompatible subject, retention policy, or storage type.`
    )
  }
}

const assertExistingConsumer = (
  configuration: PdfQueueConfiguration,
  existing: ConsumerConfig
) => {
  if (
    existing.ack_policy !== AckPolicy.Explicit ||
    existing.deliver_policy !== DeliverPolicy.All ||
    existing.filter_subject !== configuration.subject ||
    existing.replay_policy !== ReplayPolicy.Instant
  ) {
    throw new Error(
      `JetStream consumer ${configuration.consumerName} exists with an incompatible delivery contract.`
    )
  }
}

const isApiError = (cause: unknown, code: number) =>
  cause instanceof JetStreamApiError && cause.code === code

const makeMessage = (message: JsMsg): PdfQueueMessage => ({
  ack: Effect.sync(() => message.ack()),
  bytes: message.data.slice(),
  deliveryCount: message.info.deliveryCount,
  nak: (delayMilliseconds) => Effect.sync(() => message.nak(delayMilliseconds)),
  sequence: message.info.streamSequence,
  term: (reason) => Effect.sync(() => message.term(reason)),
  working: Effect.sync(() => message.working()),
})

export const makePdfQueueLayer = (configuration: PdfQueueConfiguration) =>
  Layer.effect(
    PdfQueue,
    Effect.gen(function* () {
      const connection = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () =>
            connect({
              maxReconnectAttempts: configuration.nats.maxReconnectAttempts,
              name: configuration.nats.clientName,
              pass: configuration.nats.password,
              reconnectTimeWait: 2_000,
              servers: configuration.nats.server,
              timeout: 10_000,
              user: configuration.nats.username,
            }),
          catch: (cause) => queueError('connect', cause),
        }),
        (connection) =>
          Effect.promise(() => connection.drain()).pipe(
            Effect.catch(() => Effect.promise(() => connection.close()))
          )
      )
      const manager = yield* Effect.tryPromise({
        try: () => jetstreamManager(connection),
        catch: (cause) => queueError('manager initialization', cause),
      })

      yield* Effect.tryPromise({
        try: async () => {
          const desired = streamConfiguration(configuration)
          try {
            const existing = await manager.streams.info(
              configuration.streamName
            )
            assertExistingStream(configuration, existing.config)
            await manager.streams.update(configuration.streamName, desired)
          } catch (cause) {
            if (!isApiError(cause, JetStreamApiCodes.StreamNotFound)) {
              throw cause
            }
            await manager.streams.add(desired)
          }
        },
        catch: (cause) => queueError('stream provisioning', cause),
      })

      yield* Effect.tryPromise({
        try: async () => {
          const desired = consumerConfiguration(configuration)
          try {
            const existing = await manager.consumers.info(
              configuration.streamName,
              configuration.consumerName
            )
            assertExistingConsumer(configuration, existing.config)
            await manager.consumers.update(
              configuration.streamName,
              configuration.consumerName,
              desired
            )
          } catch (cause) {
            if (!isApiError(cause, JetStreamApiCodes.ConsumerNotFound)) {
              throw cause
            }
            await manager.consumers.add(configuration.streamName, desired)
          }
        },
        catch: (cause) => queueError('consumer provisioning', cause),
      })

      const client = jetstream(connection)
      const consumer = yield* Effect.tryPromise({
        try: () =>
          client.consumers.get(
            configuration.streamName,
            configuration.consumerName
          ),
        catch: (cause) => queueError('consumer binding', cause),
      })

      const publish = Effect.fn('PdfQueue.publish')(
        (request: Parameters<typeof encodePdfQueueMessage>[0]) =>
          Effect.gen(function* () {
            const bytes = yield* encodePdfQueueMessage(request)
            const acknowledgement = yield* Effect.tryPromise({
              try: () =>
                client.publish(configuration.subject, bytes, {
                  msgID: request.artifactId,
                  timeout: 10_000,
                }),
              catch: (cause) => queueError('publish', cause),
            })
            if (acknowledgement.stream !== configuration.streamName) {
              return yield* queueError(
                'publish acknowledgement',
                new Error(
                  `Expected stream ${configuration.streamName}, received ${acknowledgement.stream}.`
                )
              )
            }
          })
      )

      const take = Effect.tryPromise({
        try: () =>
          consumer.next({ expires: configuration.pullExpiresMilliseconds }),
        catch: (cause) => queueError('pull', cause),
      }).pipe(
        Effect.map(Option.fromNullishOr),
        Effect.map(Option.map(makeMessage))
      )

      return PdfQueue.of({ configuration, publish, take })
    })
  )
