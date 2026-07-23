import { describe, expect, test } from 'bun:test'
import {
  type RegistryEventDelivery,
  RegistryEventSchema,
  RegistryEventSource,
} from '@cv/application-registry-events'
import { Effect, Fiber, Latch, Layer, Queue, Stream } from 'effect'

import {
  CacheInvalidationPermanentError,
  CacheInvalidationTransientError,
  CacheInvalidator,
  type CacheInvalidatorShape,
} from './cloudflare'
import { consumeRegistryEvent, runCacheInvalidationConsumer } from './consumer'

const event = RegistryEventSchema.cases.CvPublicationChanged.make({
  applicationId: 'application-1',
  correlationId: 'operation-1',
  eventId: 'cv-publication-changed:application-1:operation-1',
  occurredAt: '2026-07-23T12:00:00.000Z',
  version: 1,
})

const probe = (
  deliveryCount = 1,
  deliveredEvent: RegistryEventDelivery['event'] = event
) => {
  const actions: string[] = []
  const delivery: RegistryEventDelivery = {
    ack: Effect.sync(() => {
      actions.push('ack')
    }),
    deliveryCount,
    event: deliveredEvent,
    nak: (milliseconds) =>
      Effect.sync(() => {
        actions.push(`nak:${milliseconds}`)
      }),
    sequence: 1,
    term: (reason) =>
      Effect.sync(() => {
        actions.push(`term:${reason}`)
      }),
    working: Effect.void,
  }
  return { actions, delivery }
}

const layer = (invalidate: CacheInvalidatorShape['invalidate']) =>
  Layer.succeed(CacheInvalidator, CacheInvalidator.of({ invalidate }))

describe('cache invalidation event consumer', () => {
  test('purges the configured CV prefix before acknowledging', async () => {
    let invalidations = 0
    const delivery = probe()

    await Effect.runPromise(
      consumeRegistryEvent(delivery.delivery, 5).pipe(
        Effect.provide(
          layer(() =>
            Effect.sync(() => {
              invalidations += 1
            })
          )
        )
      )
    )

    expect(invalidations).toBe(1)
    expect(delivery.actions).toEqual(['ack'])
  })

  test('negatively acknowledges transient failures', async () => {
    const delivery = probe(2)

    await Effect.runPromise(
      consumeRegistryEvent(delivery.delivery, 5).pipe(
        Effect.provide(
          layer(() =>
            Effect.fail(
              new CacheInvalidationTransientError({
                cause: new Error('unavailable'),
                message: 'Cloudflare unavailable.',
              })
            )
          )
        )
      )
    )

    expect(delivery.actions).toEqual(['nak:40000'])
  })

  test('terminates permanent failures', async () => {
    const delivery = probe()

    await Effect.runPromise(
      consumeRegistryEvent(delivery.delivery, 5).pipe(
        Effect.provide(
          layer(() =>
            Effect.fail(
              new CacheInvalidationPermanentError({
                cause: new Error('invalid URL'),
                message: 'Invalid CV URL.',
              })
            )
          )
        )
      )
    )

    expect(delivery.actions).toEqual(['term:Invalid CV URL.'])
  })

  test('terminates transient failures after the delivery limit', async () => {
    const delivery = probe(5)

    await Effect.runPromise(
      consumeRegistryEvent(delivery.delivery, 5).pipe(
        Effect.provide(
          layer(() =>
            Effect.fail(
              new CacheInvalidationTransientError({
                cause: new Error('unavailable'),
                message: 'Cloudflare unavailable.',
              })
            )
          )
        )
      )
    )

    expect(delivery.actions).toEqual(['term:Cloudflare unavailable.'])
  })

  test('processes independent deliveries concurrently', async () => {
    const first = probe()
    const second = probe(1, {
      ...event,
      eventId: 'cv-publication-changed:concurrent',
    })

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const started = yield* Queue.unbounded<void>()
          const release = yield* Latch.make()
          const source = Layer.succeed(
            RegistryEventSource,
            RegistryEventSource.of({
              deliveries: Stream.fromIterable([
                first.delivery,
                second.delivery,
              ]),
              maxDeliver: 5,
              maxInFlight: 2,
            })
          )
          const invalidator = layer(() =>
            Queue.offer(started, undefined).pipe(Effect.andThen(release.await))
          )
          const consumer = yield* runCacheInvalidationConsumer.pipe(
            Effect.provide(Layer.merge(source, invalidator)),
            Effect.forkScoped
          )

          yield* Queue.take(started)
          yield* Queue.take(started)
          yield* release.open
          yield* Fiber.join(consumer)
        })
      )
    )

    expect(first.actions).toEqual(['ack'])
    expect(second.actions).toEqual(['ack'])
  })
})
