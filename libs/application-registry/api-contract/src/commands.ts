import {
  ApplicationCompensationInputSchema,
  ApplicationMutableSchema,
  ApplicationNoteSchema,
  ApplicationWritableSchema,
  CurrencyCodeSchema,
  ExpectedApplicationVersionSchema,
  ListingCheckModeSchema,
  ListingCheckTargetSchema,
  ListingObservationSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import {
  activityListQuery,
  AnnualCompensationSchema,
  applicationListQuery,
} from '@cv/application-registry-entity/query'
import {
  fromSearchParams,
  PaginationSizeSchema,
  queryParamsSchema,
  toSearchParams,
} from '@cv/drizzle-query-effect/schema'
import { Effect, Schema } from 'effect'
import { pick } from 'es-toolkit/object'

export const RegistryApplicationInputSchema = Schema.Struct({
  ...ApplicationWritableSchema.fields,
  compensations: Schema.optional(
    Schema.Array(ApplicationCompensationInputSchema)
  ),
  labels: Schema.optional(Schema.Array(NonEmptyString)),
  location: Schema.NullOr(Schema.String),
})

export type RegistryApplicationInput = Schema.Schema.Type<
  typeof RegistryApplicationInputSchema
>

/**
 * One management-screen write. Omitted related resources remain untouched;
 * present labels replace the label set and a present null compensation clears
 * the current annual compensation.
 */
export const UpdateApplicationCommandSchema = Schema.Struct({
  ...ApplicationMutableSchema.fields,
  annualCompensation: Schema.optional(Schema.NullOr(AnnualCompensationSchema)),
  expectedVersion: ExpectedApplicationVersionSchema,
  labels: Schema.optional(Schema.Array(NonEmptyString)),
})

export type UpdateApplicationCommand = Schema.Schema.Type<
  typeof UpdateApplicationCommandSchema
>

export const IdempotencyHeadersSchema = Schema.Struct({
  'idempotency-key': NonEmptyString,
})

const applicationNoteInputKeys = ['kind', 'body', 'source'] as const

export const AddApplicationNoteCommandSchema = Schema.Struct({
  ...pick(ApplicationNoteSchema.fields, applicationNoteInputKeys),
})

export type AddApplicationNoteCommand = Schema.Schema.Type<
  typeof AddApplicationNoteCommandSchema
>

export const ListingCheckFindingSchema = Schema.Struct({
  applicationId: NonEmptyString,
  postingUrl: NonEmptyString,
  observation: ListingObservationSchema,
  idempotencyKey: NonEmptyString,
  target: ListingCheckTargetSchema,
})

export type ListingCheckFinding = Schema.Schema.Type<
  typeof ListingCheckFindingSchema
>

export const SubmitListingCheckFindingsCommandSchema = Schema.Struct({
  expectedCount: Schema.Int.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  finalBatch: Schema.Boolean,
  findings: Schema.Array(ListingCheckFindingSchema),
  mode: ListingCheckModeSchema,
  startedAt: UtcIsoTimestampSchema,
})

export type SubmitListingCheckFindingsCommand = Schema.Schema.Type<
  typeof SubmitListingCheckFindingsCommandSchema
>

export const ResolveListingAvailabilityCommandSchema = Schema.Struct({
  expectedVersion: ExpectedApplicationVersionSchema,
  resolution: Schema.Literals(['open', 'closed']),
})

export type ResolveListingAvailabilityCommand = Schema.Schema.Type<
  typeof ResolveListingAvailabilityCommandSchema
>

export { PaginationSizeSchema }

export const CompensationDisplayCurrencySchema = Schema.Union([
  Schema.Literal('original'),
  CurrencyCodeSchema,
])

export const ListApplicationsQuerySchema = queryParamsSchema(
  applicationListQuery,
  {
    extras: {
      currency: Schema.optional(CompensationDisplayCurrencySchema),
      q: Schema.optional(NonEmptyString),
    },
  }
)

export type ListApplicationsQuery = Schema.Schema.Type<
  typeof ListApplicationsQuerySchema
>

/** Encodes an application-list request with the canonical HTTP query codec. */
export const encodeListApplicationsSearchParams = (
  request: ListApplicationsQuery
) =>
  Effect.runSync(
    toSearchParams(ListApplicationsQuerySchema, {
      ...request,
      filters: request.filters?.length === 0 ? undefined : request.filters,
      orderBy: request.orderBy?.length === 0 ? undefined : request.orderBy,
    })
  )

/** Decodes application-list query parameters with the canonical HTTP codec. */
export const decodeListApplicationsSearchParams = (
  input: URLSearchParams | string
) => Effect.runSync(fromSearchParams(ListApplicationsQuerySchema, input))

export const ListActivitiesQuerySchema = queryParamsSchema(activityListQuery)

export type ListActivitiesQuery = Schema.Schema.Type<
  typeof ListActivitiesQuerySchema
>

/** Encodes an activity-list request with the canonical HTTP query codec. */
export const encodeListActivitiesSearchParams = (
  request: ListActivitiesQuery
) =>
  Effect.runSync(
    toSearchParams(ListActivitiesQuerySchema, {
      ...request,
      filters: request.filters?.length === 0 ? undefined : request.filters,
      orderBy: request.orderBy?.length === 0 ? undefined : request.orderBy,
    })
  )

/** Decodes activity-list query parameters with the canonical HTTP codec. */
export const decodeListActivitiesSearchParams = (
  input: URLSearchParams | string
) => Effect.runSync(fromSearchParams(ListActivitiesQuerySchema, input))
