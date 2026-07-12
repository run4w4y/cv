import {
  AppendableApplicationEventKindSchema,
  ApplicationCompensationInputSchema,
  ApplicationEventInsertSchema,
  ApplicationMutableSchema,
  ApplicationNoteSchema,
  ApplicationStatusSchema,
  ApplicationWritableSchema,
  appendableApplicationEventKindValues,
  CampaignCaptureSchema,
  InformationalApplicationEventKindSchema,
  informationalApplicationEventKindValues,
  StatusChangingApplicationEventKindSchema,
  statusChangingApplicationEventKindValues,
  TargetStageSchema,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'
import { pick } from 'es-toolkit/object'

const NonEmptyString = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))
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
  expectedVersion: Schema.optional(Schema.Int),
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

const ListLimitSchema = Schema.NumberFromString.pipe(
  Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 }))
)

export const ListApplicationsQuerySchema = Schema.Struct({
  after: Schema.optional(NonEmptyString),
  applicationStatus: Schema.optional(ApplicationStatusSchema),
  company: Schema.optional(NonEmptyString),
  label: Schema.optional(NonEmptyString),
  limit: Schema.optional(ListLimitSchema),
  targetStage: Schema.optional(TargetStageSchema),
  url: Schema.optional(NonEmptyString),
})

export type ListApplicationsQuery = Schema.Schema.Type<
  typeof ListApplicationsQuerySchema
>

export const ListEventsQuerySchema = Schema.Struct({
  after: Schema.optional(NonEmptyString),
  limit: Schema.optional(ListLimitSchema),
})

export type ListEventsQuery = Schema.Schema.Type<typeof ListEventsQuerySchema>
