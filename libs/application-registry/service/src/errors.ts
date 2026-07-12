import type { RegistryDatabaseError } from '@cv/application-registry-crud'
import { Data } from 'effect'

export { RegistryDatabaseError } from '@cv/application-registry-crud'

export class RegistryNotFoundError extends Data.TaggedError(
  'RegistryNotFoundError'
)<{
  readonly identifier: string
  readonly message: string
}> {}

export class RegistryConflictError extends Data.TaggedError(
  'RegistryConflictError'
)<{
  readonly message: string
}> {}

export class RegistryBadRequestError extends Data.TaggedError(
  'RegistryBadRequestError'
)<{
  readonly message: string
}> {}

export type ApplicationRegistryError =
  | RegistryBadRequestError
  | RegistryConflictError
  | RegistryDatabaseError
  | RegistryNotFoundError
