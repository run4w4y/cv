import { ListApplicationsResponseSchema } from '@cv/application-registry-api-contract'
import {
  ApplicationSchema,
  ApplicationStatusSchema,
  CompensationKindSchema,
  CompensationPeriodSchema,
  CurrencyCodeSchema,
  ExpectedApplicationVersionSchema,
  NonEmptyTrimmedStringSchema,
  NonNegativeMinorAmountSchema,
  PersonalPrioritySchema,
  TargetStageSchema,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import { AnnualCompensationSchema } from '@cv/application-registry-entity/query'
import { Schema } from 'effect'

const optionalTimestamp = Schema.optionalKey(
  Schema.NullOr(UtcIsoTimestampSchema)
)

const pageSizeSchema = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 }))
)

export const SearchApplicationsParametersSchema = Schema.Struct({
  query: Schema.optionalKey(
    NonEmptyTrimmedStringSchema.annotate({
      description:
        'Case-insensitive text matched against posting URL, company, role, and location.',
    })
  ),
  applicationStatus: Schema.optionalKey(ApplicationStatusSchema),
  targetStage: Schema.optionalKey(TargetStageSchema),
  limit: Schema.optionalKey(
    pageSizeSchema.annotate({
      description: 'Number of results to return. Defaults to 20; maximum 100.',
    })
  ),
  cursor: Schema.optionalKey(
    NonEmptyTrimmedStringSchema.annotate({
      description: 'Opaque nextCursor returned by an earlier search.',
    })
  ),
})

export const GetApplicationParametersSchema = Schema.Struct({
  identifier: NonEmptyTrimmedStringSchema.annotate({
    description: 'The application ID returned by search_applications.',
  }),
})

export const ApplicationCompensationInputSchema = Schema.Struct({
  kind: CompensationKindSchema,
  currencyCode: CurrencyCodeSchema,
  minimumMinor: Schema.optionalKey(Schema.NullOr(NonNegativeMinorAmountSchema)),
  maximumMinor: Schema.optionalKey(Schema.NullOr(NonNegativeMinorAmountSchema)),
  period: CompensationPeriodSchema,
  rawText: Schema.optionalKey(Schema.NullOr(Schema.String)),
  source: NonEmptyTrimmedStringSchema,
}).pipe(
  Schema.check(
    Schema.makeFilter((value) =>
      value.minimumMinor === undefined ||
      value.maximumMinor === undefined ||
      value.minimumMinor === null ||
      value.maximumMinor === null ||
      value.minimumMinor <= value.maximumMinor
        ? undefined
        : {
            path: ['maximumMinor'],
            issue:
              'Maximum compensation must be greater than or equal to minimum compensation.',
          }
    )
  )
)

export const CreateApplicationParametersSchema = Schema.Struct({
  postingUrl: NonEmptyTrimmedStringSchema,
  company: NonEmptyTrimmedStringSchema,
  role: NonEmptyTrimmedStringSchema,
  location: Schema.NullOr(NonEmptyTrimmedStringSchema).annotate({
    description: 'Use null when the listing does not specify a location.',
  }),
  applicationStatus: Schema.optionalKey(ApplicationStatusSchema),
  targetStage: Schema.optionalKey(TargetStageSchema),
  personalPriority: Schema.optionalKey(Schema.NullOr(PersonalPrioritySchema)),
  followUpAt: optionalTimestamp,
  appliedAt: optionalTimestamp,
  compensations: Schema.optionalKey(
    Schema.Array(ApplicationCompensationInputSchema)
  ),
  labels: Schema.optionalKey(Schema.Array(NonEmptyTrimmedStringSchema)),
})

export const UpdateApplicationParametersSchema = Schema.Struct({
  identifier: NonEmptyTrimmedStringSchema.annotate({
    description: 'The application ID returned by search_applications.',
  }),
  expectedVersion: ExpectedApplicationVersionSchema.annotate({
    description:
      'Current application version returned by get_application or search_applications. Updates fail on stale versions.',
  }),
  postingUrl: Schema.optionalKey(NonEmptyTrimmedStringSchema),
  company: Schema.optionalKey(NonEmptyTrimmedStringSchema),
  role: Schema.optionalKey(NonEmptyTrimmedStringSchema),
  location: Schema.optionalKey(Schema.NullOr(NonEmptyTrimmedStringSchema)),
  applicationStatus: Schema.optionalKey(ApplicationStatusSchema),
  targetStage: Schema.optionalKey(TargetStageSchema),
  personalPriority: Schema.optionalKey(Schema.NullOr(PersonalPrioritySchema)),
  followUpAt: optionalTimestamp,
  appliedAt: optionalTimestamp,
  annualCompensation: Schema.optionalKey(
    Schema.NullOr(AnnualCompensationSchema)
  ),
  labels: Schema.optionalKey(Schema.Array(NonEmptyTrimmedStringSchema)),
})

export const ApplicationResultSchema = Schema.Struct({
  application: ApplicationSchema,
})

export const UpdateApplicationResultSchema = Schema.Struct({
  operationId: Schema.String,
  annualCompensation: Schema.NullOr(AnnualCompensationSchema),
  application: ApplicationSchema,
  labels: Schema.Array(NonEmptyTrimmedStringSchema),
})

export { ListApplicationsResponseSchema }
