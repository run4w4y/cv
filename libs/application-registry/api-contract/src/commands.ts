import {
  AppendableApplicationEventKindSchema,
  ApplicationCompensationInputSchema,
  ApplicationEventInsertSchema,
  ApplicationEventKindSchema,
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
  FitScoreSchema,
  InformationalApplicationEventKindSchema,
  informationalApplicationEventKindValues,
  ListingCheckModeSchema,
  ListingCheckTargetSchema,
  ListingObservationSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
  PersonalPrioritySchema,
  StatusChangingApplicationEventKindSchema,
  statusChangingApplicationEventKindValues,
  TargetStageSchema,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import { Schema, SchemaGetter } from 'effect'
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

export const ListLimitValueSchema = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 }))
)

const ListLimitSchema = Schema.NumberFromString.pipe(
  Schema.decodeTo(ListLimitValueSchema)
)

const FitScoreFromStringSchema = Schema.NumberFromString.pipe(
  Schema.decodeTo(FitScoreSchema)
)

const OptionalFitScoreQueryValueSchema = Schema.Union([
  Schema.Literal(''),
  FitScoreFromStringSchema,
]).pipe(
  Schema.decodeTo(Schema.UndefinedOr(FitScoreSchema), {
    decode: SchemaGetter.transform((value) =>
      value === '' ? undefined : value
    ),
    encode: SchemaGetter.transform((value) => value ?? ''),
  })
)

export const CompensationDisplayCurrencySchema = Schema.Union([
  Schema.Literal('original'),
  CurrencyCodeSchema,
])

export const FollowUpStateSchema = Schema.Literals([
  'none',
  'overdue',
  'upcoming',
])

export type FollowUpState = Schema.Schema.Type<typeof FollowUpStateSchema>

const ListApplicationsQueryFieldsSchema = Schema.Struct({
  after: Schema.optional(NonEmptyString),
  applicationStatus: Schema.optional(
    Schema.Union([
      ApplicationStatusSchema,
      Schema.Array(ApplicationStatusSchema),
    ])
  ),
  company: Schema.optional(NonEmptyString),
  currency: Schema.optional(CompensationDisplayCurrencySchema),
  fitScoreMax: Schema.optional(OptionalFitScoreQueryValueSchema),
  fitScoreMin: Schema.optional(OptionalFitScoreQueryValueSchema),
  followUpState: Schema.optional(
    Schema.Union([FollowUpStateSchema, Schema.Array(FollowUpStateSchema)])
  ),
  label: Schema.optional(
    Schema.Union([NonEmptyString, Schema.Array(NonEmptyString)])
  ),
  limit: Schema.optional(ListLimitSchema),
  location: Schema.optional(NonEmptyString),
  personalPriority: Schema.optional(
    Schema.Union([PersonalPrioritySchema, Schema.Array(PersonalPrioritySchema)])
  ),
  q: Schema.optional(NonEmptyString),
  role: Schema.optional(NonEmptyString),
  targetStage: Schema.optional(
    Schema.Union([TargetStageSchema, Schema.Array(TargetStageSchema)])
  ),
  url: Schema.optional(NonEmptyString),
})

type ListApplicationsQueryFields = Schema.Schema.Type<
  typeof ListApplicationsQueryFieldsSchema
>

export const ListApplicationsQuerySchema =
  ListApplicationsQueryFieldsSchema.pipe(
    Schema.check(
      Schema.makeFilter((query: ListApplicationsQueryFields) =>
        query.fitScoreMin !== undefined &&
        query.fitScoreMax !== undefined &&
        query.fitScoreMin > query.fitScoreMax
          ? {
              issue:
                'fitScoreMax must be greater than or equal to fitScoreMin.',
              path: ['fitScoreMax'],
            }
          : undefined
      )
    )
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

export const ListEventsQuerySchema = Schema.Struct({
  after: Schema.optional(NonEmptyString),
  from: Schema.optional(UtcIsoTimestampSchema),
  kind: Schema.optional(
    Schema.Union([
      ApplicationEventKindSchema,
      Schema.Array(ApplicationEventKindSchema),
    ])
  ),
  limit: Schema.optional(ListLimitSchema),
  to: Schema.optional(UtcIsoTimestampSchema),
})

export type ListEventsQuery = Schema.Schema.Type<typeof ListEventsQuerySchema>
