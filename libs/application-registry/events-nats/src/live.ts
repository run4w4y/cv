import {
  type RegistryEventDelivery,
  RegistryEventPublishError,
  RegistryEventPublisher,
  RegistryEventSource,
  RegistryEventSourceError,
} from '@cv/application-registry-events'
import { type JsMsg, jetstream } from '@nats-io/jetstream'
import { connect } from '@nats-io/transport-node'
import { Effect, Layer, Option, Predicate, Stream } from 'effect'

import { decodeRegistryEvent, encodeRegistryEvent } from './codec'
import { releaseNatsConnection } from './connection'
import { natsMessageAction } from './delivery'
import type {
  RegistryEventConsumerConfiguration,
  RegistryEventNatsConnection,
  RegistryEventPublisherConfiguration,
} from './model'
import { registryEventSubject } from './subjects'

const messageOf = (cause: unknown) =>
  Predicate.isError(cause) ? cause.message : String(cause)

const sourceError = (operation: string, cause: unknown) =>
  new RegistryEventSourceError({
    cause,
    message: `Registry event source ${operation} failed: ${messageOf(cause)}`,
    operation,
  })

const publisherError = (eventId: string, operation: string, cause: unknown) =>
  new RegistryEventPublishError({
    cause,
    eventId,
    message: `Registry event ${operation} failed: ${messageOf(cause)}`,
  })

const acquireConnection = (
  configuration: RegistryEventNatsConnection,
  connectNats: typeof connect = connect
) =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: () =>
        connectNats({
          maxReconnectAttempts: configuration.maxReconnectAttempts,
          name: configuration.clientName,
          pass: configuration.password,
          reconnectTimeWait: 2_000,
          servers: configuration.server,
          timeout: 10_000,
          user: configuration.username,
        }),
      catch: (cause) => sourceError('connection', cause),
    }),
    releaseNatsConnection
  )

const makeDelivery = (
  message: JsMsg
): Effect.Effect<
  Option.Option<RegistryEventDelivery>,
  RegistryEventSourceError
> =>
  decodeRegistryEvent(message.data).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.logWarning('RegistryEvents.invalid_message', {
          message: error.message,
          sequence: message.info.streamSequence,
        }).pipe(
          Effect.andThen(
            natsMessageAction('message termination', () =>
              message.term(error.message)
            )
          ),
          Effect.as(Option.none())
        ),
      onSuccess: (event) =>
        Effect.succeed(
          Option.some({
            ack: natsMessageAction('message acknowledgement', () =>
              message.ack()
            ),
            deliveryCount: message.info.deliveryCount,
            event,
            nak: (delayMilliseconds) =>
              natsMessageAction('message negative acknowledgement', () =>
                message.nak(delayMilliseconds)
              ),
            sequence: message.info.streamSequence,
            term: (reason) =>
              natsMessageAction('message termination', () =>
                message.term(reason)
              ),
            working: natsMessageAction('message heartbeat', () =>
              message.working()
            ),
          })
        ),
    })
  )

export const makeNatsRegistryEventPublisherLayer = (
  configuration: RegistryEventPublisherConfiguration,
  options: { readonly connect?: typeof connect } = {}
) =>
  Layer.succeed(
    RegistryEventPublisher,
    RegistryEventPublisher.of({
      publish: Effect.fn('RegistryEventPublisher.nats')((event) =>
        Effect.scoped(
          Effect.gen(function* () {
            const connection = yield* acquireConnection(
              configuration.nats,
              options.connect
            ).pipe(
              Effect.mapError((error) =>
                publisherError(event.eventId, 'connection', error)
              )
            )
            const bytes = yield* encodeRegistryEvent(event)
            const acknowledgement = yield* Effect.tryPromise({
              try: () =>
                jetstream(connection).publish(
                  registryEventSubject(configuration.topology, event),
                  bytes,
                  {
                    msgID: event.eventId,
                    timeout: 10_000,
                  }
                ),
              catch: (cause) => publisherError(event.eventId, 'publish', cause),
            })
            if (acknowledgement.stream !== configuration.topology.streamName) {
              return yield* publisherError(
                event.eventId,
                'publish acknowledgement',
                new Error(
                  `Expected stream ${configuration.topology.streamName}, received ${acknowledgement.stream}.`
                )
              )
            }
          })
        )
      ),
    })
  )

export const makeNatsRegistryEventSourceLayer = (
  configuration: RegistryEventConsumerConfiguration
) =>
  Layer.effect(
    RegistryEventSource,
    Effect.gen(function* () {
      const connection = yield* acquireConnection(configuration.nats)
      const client = jetstream(connection)
      const consumer = yield* Effect.tryPromise({
        try: () =>
          client.consumers.get(
            configuration.topology.streamName,
            configuration.consumerName
          ),
        catch: (cause) => sourceError('consumer binding', cause),
      })
      const consumerInfo = yield* Effect.tryPromise({
        try: () => consumer.info(true),
        catch: (cause) => sourceError('consumer inspection', cause),
      })
      const maxDeliver = consumerInfo.config.max_deliver
      const maxInFlight = consumerInfo.config.max_ack_pending
      if (
        typeof maxDeliver !== 'number' ||
        !Number.isInteger(maxDeliver) ||
        maxDeliver <= 0
      ) {
        return yield* sourceError(
          'consumer validation',
          new Error(
            `Consumer ${configuration.consumerName} must have a finite positive max_deliver value.`
          )
        )
      }
      if (
        typeof maxInFlight !== 'number' ||
        !Number.isInteger(maxInFlight) ||
        maxInFlight <= 0
      ) {
        return yield* sourceError(
          'consumer validation',
          new Error(
            `Consumer ${configuration.consumerName} must have a finite positive max_ack_pending value.`
          )
        )
      }
      const next = Effect.tryPromise({
        try: () =>
          consumer.next({ expires: configuration.pullExpiresMilliseconds }),
        catch: (cause) => sourceError('pull', cause),
      }).pipe(
        Effect.flatMap((message) =>
          message === null
            ? Effect.succeed(Option.none())
            : makeDelivery(message)
        )
      )

      return RegistryEventSource.of({
        deliveries: Stream.fromEffectRepeat(next).pipe(
          Stream.filter(Option.isSome),
          Stream.map((value) => value.value)
        ),
        maxDeliver,
        maxInFlight,
      })
    })
  )
