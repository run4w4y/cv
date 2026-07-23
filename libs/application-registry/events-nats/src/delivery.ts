import { RegistryEventSourceError } from '@cv/application-registry-events'
import { Effect, Predicate } from 'effect'

const messageOf = (cause: unknown) =>
  Predicate.isError(cause) ? cause.message : String(cause)

export const natsMessageAction = (operation: string, action: () => void) =>
  Effect.try({
    try: action,
    catch: (cause) =>
      new RegistryEventSourceError({
        cause,
        message: `Registry event source ${operation} failed: ${messageOf(cause)}`,
        operation,
      }),
  })
