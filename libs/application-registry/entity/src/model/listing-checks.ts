import { Schema } from 'effect'

import {
  NonEmptyTrimmedStringSchema as NonEmptyString,
  UtcIsoTimestampSchema,
} from './constraints'
import {
  ListingCheckConfidenceSchema,
  ListingCheckOutcomeSchema,
  ListingCheckReasonSchema,
} from './values'

export const ListingCheckEvidenceSchema = Schema.Struct({
  code: Schema.NonEmptyString,
  detail: Schema.NonEmptyString,
  sourceUrl: Schema.NullOr(Schema.NonEmptyString),
})

export type ListingCheckEvidence = Schema.Schema.Type<
  typeof ListingCheckEvidenceSchema
>

export const ListingCheckTargetSchema = Schema.Struct({
  company: NonEmptyString,
  role: NonEmptyString,
  url: NonEmptyString,
})

export type ListingCheckTarget = Schema.Schema.Type<
  typeof ListingCheckTargetSchema
>

export const ListingObservationSchema = Schema.Struct({
  checkedAt: UtcIsoTimestampSchema,
  checkerVersion: NonEmptyString,
  confidence: ListingCheckConfidenceSchema,
  contentHash: Schema.NullOr(NonEmptyString),
  evidence: Schema.Array(ListingCheckEvidenceSchema),
  finalUrl: Schema.NullOr(NonEmptyString),
  httpStatus: Schema.NullOr(
    Schema.Int.pipe(
      Schema.check(Schema.isBetween({ minimum: 100, maximum: 599 }))
    )
  ),
  outcome: ListingCheckOutcomeSchema,
  provider: NonEmptyString,
  reasonCode: ListingCheckReasonSchema,
  requestedUrl: NonEmptyString,
})

export type ListingObservation = Schema.Schema.Type<
  typeof ListingObservationSchema
>
