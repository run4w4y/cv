import { Effect, Schedule } from 'effect'

import type { ApplicationRegistryClientError } from '../errors'
import {
  ApplicationRegistryHttpError,
  ApplicationRegistryRequestError,
  ApplicationRegistryResponseError,
  normalizeApplicationRegistryClientError,
} from '../errors'
import type { RegistryOutboxDisposition } from '../outbox'

export type RegistryFailureDisposition = Exclude<
  RegistryOutboxDisposition,
  'pending' | 'synced'
>

export const registryFailureDisposition = (
  error: ApplicationRegistryClientError
): RegistryFailureDisposition => {
  if (error instanceof ApplicationRegistryResponseError) return 'dead-letter'
  if (error instanceof ApplicationRegistryRequestError) return 'retry'
  if (error instanceof ApplicationRegistryHttpError) {
    if (error.dispositionHint !== undefined) return error.dispositionHint
    if (error.status === 401 || error.status === 403) return 'blocked'
    if (
      error.status >= 500 ||
      error.status === 408 ||
      error.status === 425 ||
      error.status === 429
    ) {
      return 'retry'
    }
  }
  return 'dead-letter'
}

const transientRetrySchedule = Schedule.exponential('100 millis').pipe(
  Schedule.jittered,
  Schedule.take(2)
)

export const normalizeHttpFailure = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, ApplicationRegistryClientError, R> =>
  effect.pipe(Effect.mapError(normalizeApplicationRegistryClientError))

export const withTransientRetries = <A>(
  effect: Effect.Effect<A, ApplicationRegistryClientError>
) =>
  effect.pipe(
    Effect.retry({
      schedule: transientRetrySchedule,
      while: (error) => registryFailureDisposition(error) === 'retry',
    })
  )
