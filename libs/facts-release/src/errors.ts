import { Schema } from 'effect'

const factsReleaseAssetIssues = [
  'digest-mismatch',
  'duplicate-source',
  'media-type-conflict',
  'missing-source',
  'unexpected-source',
] as const

export type FactsReleaseAssetIssue = (typeof factsReleaseAssetIssues)[number]

export class FactsReleaseAssetError extends Schema.TaggedErrorClass<FactsReleaseAssetError>()(
  'FactsReleaseAssetError',
  {
    actual: Schema.NullOr(Schema.String),
    assetId: Schema.String,
    expected: Schema.NullOr(Schema.String),
    issue: Schema.Literals(factsReleaseAssetIssues),
    message: Schema.String,
  }
) {}

export class FactsReleaseHashError extends Schema.TaggedErrorClass<FactsReleaseHashError>()(
  'FactsReleaseHashError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

export class FactsReleaseBundleError extends Schema.TaggedErrorClass<FactsReleaseBundleError>()(
  'FactsReleaseBundleError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
    issue: Schema.Literals(['decode', 'integrity', 'layout']),
  }
) {}
