import type {
  RegistryDatabaseError,
  RegistryQueryTooComplexError,
} from '@cv/application-registry-crud'
import { Data } from 'effect'

export {
  RegistryDatabaseError,
  RegistryQueryTooComplexError,
} from '@cv/application-registry-crud'

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

export class RegistryArtifactError extends Data.TaggedError(
  'RegistryArtifactError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly operation: 'read' | 'verify' | 'write'
}> {}

export class RegistryAnalyticsError extends Data.TaggedError(
  'RegistryAnalyticsError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export type ApplicationRegistryError =
  | RegistryAnalyticsError
  | RegistryArtifactError
  | RegistryBadRequestError
  | RegistryConflictError
  | RegistryDatabaseError
  | RegistryNotFoundError
  | RegistryQueryTooComplexError
