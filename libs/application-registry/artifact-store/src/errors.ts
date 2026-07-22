import { Data } from 'effect'

export class ArtifactStoreAddressError extends Data.TaggedError(
  'ArtifactStoreAddressError'
)<{
  readonly message: string
  readonly sha256: string
}> {}

export class ArtifactStoreHashError extends Data.TaggedError(
  'ArtifactStoreHashError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export class ArtifactStoreReadError extends Data.TaggedError(
  'ArtifactStoreReadError'
)<{
  readonly cause: unknown
  readonly key: string
  readonly message: string
  readonly operation: 'head' | 'read'
}> {}

export class ArtifactStoreWriteError extends Data.TaggedError(
  'ArtifactStoreWriteError'
)<{
  readonly cause: unknown
  readonly key: string
  readonly message: string
}> {}

export class ArtifactStoreNotFoundError extends Data.TaggedError(
  'ArtifactStoreNotFoundError'
)<{
  readonly key: string
  readonly message: string
  readonly sha256: string
}> {}

export class ArtifactStoreIntegrityError extends Data.TaggedError(
  'ArtifactStoreIntegrityError'
)<{
  readonly key: string
  readonly message: string
  readonly sha256: string
}> {}

export type ArtifactStoreHeadError =
  | ArtifactStoreAddressError
  | ArtifactStoreIntegrityError
  | ArtifactStoreReadError

export type ArtifactStorePutError =
  | ArtifactStoreHashError
  | ArtifactStoreIntegrityError
  | ArtifactStoreReadError
  | ArtifactStoreWriteError

export type ArtifactStoreReadFailure =
  | ArtifactStoreAddressError
  | ArtifactStoreHashError
  | ArtifactStoreIntegrityError
  | ArtifactStoreNotFoundError
  | ArtifactStoreReadError
