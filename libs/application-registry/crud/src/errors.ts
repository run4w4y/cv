import { Data } from 'effect'

export class RegistryDatabaseError extends Data.TaggedError(
  'RegistryDatabaseError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

/** A read query that cannot be executed within the target database budget. */
export class RegistryQueryTooComplexError extends Data.TaggedError(
  'RegistryQueryTooComplexError'
)<{
  readonly maxParameters: number
  readonly message: string
  readonly parameterCount: number
}> {}

export const databaseFailure = (message: string) => (cause: unknown) =>
  new RegistryDatabaseError({ cause, message })
