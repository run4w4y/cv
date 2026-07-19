import { Schema } from 'effect'

export class FactsObjectNotFoundError extends Schema.TaggedErrorClass<FactsObjectNotFoundError>()(
  'FactsObjectNotFoundError',
  {
    key: Schema.String,
    message: Schema.String,
  }
) {}

export class FactsObjectStoreError extends Schema.TaggedErrorClass<FactsObjectStoreError>()(
  'FactsObjectStoreError',
  {
    cause: Schema.Defect(),
    key: Schema.String,
    message: Schema.String,
    operation: Schema.Literals(['get', 'head', 'put']),
  }
) {}

export class FactsReaderError extends Schema.TaggedErrorClass<FactsReaderError>()(
  'FactsReaderError',
  {
    cause: Schema.Defect(),
    key: Schema.String,
    message: Schema.String,
    operation: Schema.Literals([
      'decode-current',
      'decode-manifest',
      'decode-catalogue',
      'read-current',
      'read-manifest',
      'read-catalogue',
      'verify-manifest',
      'verify-catalogue',
    ]),
  }
) {}
