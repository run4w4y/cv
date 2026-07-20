import { Schema } from 'effect'

export class FactsPublisherConfigError extends Schema.TaggedErrorClass<FactsPublisherConfigError>()(
  'FactsPublisherConfigError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

export class FactsPublisherSourceError extends Schema.TaggedErrorClass<FactsPublisherSourceError>()(
  'FactsPublisherSourceError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
    operation: Schema.Literal('load-source'),
  }
) {}

export type FactsPublisherError =
  | FactsPublisherConfigError
  | FactsPublisherSourceError
