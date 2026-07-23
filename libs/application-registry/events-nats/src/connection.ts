import { Effect, Predicate } from 'effect'

interface NatsConnectionResource {
  readonly close: () => Promise<void>
  readonly drain: () => Promise<void>
}

const messageOf = (cause: unknown) =>
  Predicate.isError(cause) ? cause.message : String(cause)

const closeAfterFailedDrain = (
  connection: NatsConnectionResource,
  drainCause: unknown
) =>
  Effect.logWarning('RegistryEvents.connection_drain_failed', {
    message: messageOf(drainCause),
  }).pipe(
    Effect.andThen(
      Effect.tryPromise({
        try: () => connection.close(),
        catch: (cause) => cause,
      }).pipe(
        Effect.catch((closeCause) =>
          Effect.logWarning('RegistryEvents.connection_close_failed', {
            message: messageOf(closeCause),
          })
        )
      )
    )
  )

export const releaseNatsConnection = (
  connection: NatsConnectionResource
): Effect.Effect<void> =>
  Effect.tryPromise({
    try: () => connection.drain(),
    catch: (cause) => cause,
  }).pipe(
    Effect.catch((drainCause) => closeAfterFailedDrain(connection, drainCause))
  )
