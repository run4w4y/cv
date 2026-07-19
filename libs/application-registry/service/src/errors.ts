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

export type FactsReleaseObjectKind = 'asset' | 'catalog' | 'manifest'

export class FactsReleaseObjectNotFoundError extends Data.TaggedError(
  'FactsReleaseObjectNotFoundError'
)<{
  readonly logicalId: string
  readonly message: string
  readonly objectKind: FactsReleaseObjectKind
  readonly releaseId: string
  readonly sha256: string
}> {}

export class FactsReleaseObjectMetadataError extends Data.TaggedError(
  'FactsReleaseObjectMetadataError'
)<{
  readonly actual: number | string
  readonly expected: number | string
  readonly field: 'byteLength' | 'key' | 'sha256'
  readonly logicalId: string
  readonly message: string
  readonly objectKind: FactsReleaseObjectKind
  readonly releaseId: string
}> {}

export type ApplicationRegistryError =
  | FactsReleaseObjectMetadataError
  | FactsReleaseObjectNotFoundError
  | RegistryAnalyticsError
  | RegistryArtifactError
  | RegistryBadRequestError
  | RegistryConflictError
  | RegistryDatabaseError
  | RegistryNotFoundError
  | RegistryQueryTooComplexError

export type FactsReleasesServiceError = ApplicationRegistryError
