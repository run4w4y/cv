import { Data } from 'effect'

export class RegistryDatabaseError extends Data.TaggedError(
  'RegistryDatabaseError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export const databaseFailure = (message: string) => (cause: unknown) =>
  new RegistryDatabaseError({ cause, message })
