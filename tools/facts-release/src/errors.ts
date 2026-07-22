import { Schema } from 'effect'

export class FactsToolchainError extends Schema.TaggedErrorClass<FactsToolchainError>()(
  'FactsToolchainError',
  {
    cause: Schema.Defect(),
    issue: Schema.Literals(['configuration', 'http', 'io']),
    message: Schema.String,
  }
) {}

export class FactsToolchainSourceError extends Schema.TaggedErrorClass<FactsToolchainSourceError>()(
  'FactsToolchainSourceError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
    operation: Schema.Literal('load-source'),
  }
) {}

export type FactsToolchainFailure =
  | FactsToolchainError
  | FactsToolchainSourceError
