import { Data } from 'effect'

export type FactsReleaseAssetIssue =
  | 'digest-mismatch'
  | 'duplicate-source'
  | 'invalid-file-name'
  | 'missing-source'
  | 'unexpected-source'

export class FactsReleaseValidationError extends Data.TaggedError(
  'FactsReleaseValidationError'
)<{
  readonly cause: unknown
  readonly context: 'catalogue' | 'manifest' | 'provenance' | 'timestamp'
  readonly message: string
}> {}

export class FactsReleaseAssetError extends Data.TaggedError(
  'FactsReleaseAssetError'
)<{
  readonly actual: string | null
  readonly assetId: string
  readonly expected: string | null
  readonly issue: FactsReleaseAssetIssue
  readonly message: string
}> {}

export class FactsReleaseHashError extends Data.TaggedError(
  'FactsReleaseHashError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export class FactsReleaseIntegrityError extends Data.TaggedError(
  'FactsReleaseIntegrityError'
)<{
  readonly key: string
  readonly message: string
}> {}

export class FactsReleasePublicationError extends Data.TaggedError(
  'FactsReleasePublicationError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly operation: 'activate' | 'upload'
}> {}
