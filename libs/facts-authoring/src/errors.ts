import { Schema } from 'effect'

export class FactsAuthoringValidationError extends Schema.TaggedErrorClass<FactsAuthoringValidationError>()(
  'FactsAuthoring.ValidationError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
    path: Schema.String,
  }
) {}

export class FactsAuthoringCompositionError extends Schema.TaggedErrorClass<FactsAuthoringCompositionError>()(
  'FactsAuthoring.CompositionError',
  {
    message: Schema.String,
    path: Schema.String,
  }
) {}
