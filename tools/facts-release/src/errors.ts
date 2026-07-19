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

export type FactsPublisherError =
  | FactsPublisherConfigError
  | FactsPublisherSourceError
