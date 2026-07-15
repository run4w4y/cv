import {
  AppendableApplicationEventKindSchema,
  ApplicationCompensationInputSchema,
  ApplicationEventInsertSchema,
  ApplicationIdentityResolutionSchema,
  ApplicationMutableSchema,
  ApplicationNoteSchema,
  ApplicationStatusSchema,
  ApplicationWritableSchema,
  appendableApplicationEventKindValues,
  CampaignCaptureSchema,
  CurrencyCodeSchema,
  ExpectedApplicationVersionSchema,
  FitAssessmentSchema,
  InformationalApplicationEventKindSchema,
  informationalApplicationEventKindValues,
  ListingCheckModeSchema,
  ListingCheckTargetSchema,
  ListingObservationSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
  StatusChangingApplicationEventKindSchema,
  statusChangingApplicationEventKindValues,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import {
  applicationListQuery,
  eventListQuery,
} from '@cv/application-registry-entity/query'
import {
  PaginationSizeSchema,
  queryParamsSchema,
} from '@cv/drizzle-query-effect/schema'
import { Schema } from 'effect'
import { pick } from 'es-toolkit/object'

const NullableNonEmptyString = Schema.NullOr(NonEmptyString)

export const RegistryApplicationInputSchema = Schema.Struct({
  ...ApplicationWritableSchema.fields,
  compensations: Schema.optional(
    Schema.Array(ApplicationCompensationInputSchema)
  ),
  labels: Schema.optional(Schema.Array(NonEmptyString)),
  location: Schema.NullOr(Schema.String),
  sourceJobId: NullableNonEmptyString,
})

export type RegistryApplicationInput = Schema.Schema.Type<
  typeof RegistryApplicationInputSchema
>

export const PatchApplicationCommandSchema = Schema.Struct({
  ...ApplicationMutableSchema.fields,
  expectedVersion: Schema.optional(ExpectedApplicationVersionSchema),
})

export type PatchApplicationCommand = Schema.Schema.Type<
  typeof PatchApplicationCommandSchema
>

const applicationNoteInputKeys = ['kind', 'body', 'source'] as const

export const AddApplicationNoteCommandSchema = Schema.Struct({
  ...pick(ApplicationNoteSchema.fields, applicationNoteInputKeys),
  operationId: NonEmptyString,
})

export type AddApplicationNoteCommand = Schema.Schema.Type<
  typeof AddApplicationNoteCommandSchema
>

const campaignCaptureInputKeys = [
  'campaignRunId',
  'profile',
  'audience',
  'confidence',
  'applicationUrl',
  'submissionDetails',
  'artifacts',
  'jobContentHash',
  'capturedAt',
] as const

export const CreateCampaignCaptureCommandSchema = Schema.Struct({
  ...RegistryApplicationInputSchema.fields,
  ...pick(CampaignCaptureSchema.fields, campaignCaptureInputKeys),
  operationId: NonEmptyString,
  campaignRunId: NonEmptyString,
  profile: NonEmptyString,
  audience: NullableNonEmptyString,
  jobContentHash: NullableNonEmptyString,
  deviceId: NullableNonEmptyString,
  fitAssessment: Schema.optional(FitAssessmentSchema),
  identityResolution: Schema.optional(ApplicationIdentityResolutionSchema),
})

export type CreateCampaignCaptureCommand = Schema.Schema.Type<
  typeof CreateCampaignCaptureCommandSchema
>

export type { AppendableApplicationEventKind } from '@cv/application-registry-entity'
export {
  AppendableApplicationEventKindSchema,
  appendableApplicationEventKindValues,
  informationalApplicationEventKindValues,
  statusChangingApplicationEventKindValues,
}

const appendApplicationEventInputKeys = ['occurredAt', 'payload'] as const

const appendApplicationEventFields = {
  ...pick(ApplicationEventInsertSchema.fields, appendApplicationEventInputKeys),
  operationId: NonEmptyString,
  deviceId: NullableNonEmptyString,
  expectedVersion: Schema.NullOr(Schema.Int),
}

export const AppendApplicationEventCommandSchema = Schema.Union([
  Schema.Struct({
    ...appendApplicationEventFields,
    kind: StatusChangingApplicationEventKindSchema,
    nextApplicationStatus: ApplicationStatusSchema,
  }),
  Schema.Struct({
    ...appendApplicationEventFields,
    kind: InformationalApplicationEventKindSchema,
  }),
])

export type AppendApplicationEventCommand = Schema.Schema.Type<
  typeof AppendApplicationEventCommandSchema
>

export const ListingCheckFindingSchema = Schema.Struct({
  applicationId: NonEmptyString,
  canonicalUrl: NonEmptyString,
  observation: ListingObservationSchema,
  operationId: NonEmptyString,
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
  runId: NonEmptyString,
  startedAt: UtcIsoTimestampSchema,
})

export type SubmitListingCheckFindingsCommand = Schema.Schema.Type<
  typeof SubmitListingCheckFindingsCommandSchema
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
    },
  }
)

export type ListApplicationsQuery = Schema.Schema.Type<
  typeof ListApplicationsQuerySchema
>

export const DeleteApplicationQuerySchema = Schema.Struct({
  expectedVersion: Schema.optional(
    Schema.NumberFromString.pipe(
      Schema.decodeTo(ExpectedApplicationVersionSchema)
    )
  ),
})

export type DeleteApplicationQuery = Schema.Schema.Type<
  typeof DeleteApplicationQuerySchema
>

export const ListEventsQuerySchema = queryParamsSchema(eventListQuery)

export type ListEventsQuery = Schema.Schema.Type<typeof ListEventsQuerySchema>
