import { Data } from 'effect'

export class FactsPublisherConfigError extends Data.TaggedError(
  'FactsPublisherConfigError'
)<{
  readonly message: string
}> {}

export class FactsPublisherSourceError extends Data.TaggedError(
  'FactsPublisherSourceError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly operation: 'load-source' | 'read-assets' | 'resolve-assets'
}> {}

export class FactsPublisherHttpError extends Data.TaggedError(
  'FactsPublisherHttpError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly operation:
    | 'activate-channel'
    | 'read-channel'
    | 'read-release'
    | 'register-release'
    | 'upload-object'
  readonly status: number | null
}> {}

export class FactsPublisherIntegrityError extends Data.TaggedError(
  'FactsPublisherIntegrityError'
)<{
  readonly actual: number | string
  readonly expected: number | string
  readonly field: string
  readonly message: string
  readonly operation: 'activate-channel' | 'register-release' | 'upload-object'
}> {}

export type FactsPublisherError =
  | FactsPublisherConfigError
  | FactsPublisherHttpError
  | FactsPublisherIntegrityError
  | FactsPublisherSourceError
