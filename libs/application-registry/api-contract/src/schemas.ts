import {
  ApplicationCompensationSchema,
  ApplicationEventSchema,
  ApplicationLabelSchema,
  ApplicationNoteSchema,
  ApplicationSchema,
  CampaignCaptureSchema,
  CurrencyCodeSchema,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'
import { HttpApiSchema } from 'effect/unstable/httpapi'

export type {
  AddApplicationNoteCommand as AddApplicationNoteRequest,
  AppendApplicationEventCommand as AppendApplicationEventRequest,
  CreateCampaignCaptureCommand as CreateCampaignCaptureRequest,
  ListApplicationsQuery,
  ListEventsQuery,
  PatchApplicationCommand as PatchApplicationRequest,
  RegistryApplicationInput as UpsertApplicationRequest,
} from './commands'
export {
  AddApplicationNoteCommandSchema as AddApplicationNoteRequestSchema,
  AppendApplicationEventCommandSchema as AppendApplicationEventRequestSchema,
  CreateCampaignCaptureCommandSchema as CreateCampaignCaptureRequestSchema,
  ListApplicationsQuerySchema,
  ListEventsQuerySchema,
  PatchApplicationCommandSchema as PatchApplicationRequestSchema,
  RegistryApplicationInputSchema as UpsertApplicationRequestSchema,
} from './commands'

const NonEmptyString = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))

export const ApplicationIdentifierParamsSchema = Schema.Struct({
  id: NonEmptyString,
})

const RevisionPageFields = {
  checkpoint: Schema.NullOr(NonEmptyString),
  nextCursor: Schema.NullOr(NonEmptyString),
}

export const ListApplicationsResponseSchema = Schema.Struct({
  items: Schema.Array(ApplicationSchema),
  ...RevisionPageFields,
})

export type ListApplicationsResponse = Schema.Schema.Type<
  typeof ListApplicationsResponseSchema
>

export const ReplaceApplicationLabelsRequestSchema = Schema.Struct({
  labels: Schema.Array(NonEmptyString),
})

export type ReplaceApplicationLabelsRequest = Schema.Schema.Type<
  typeof ReplaceApplicationLabelsRequestSchema
>

export const ListApplicationLabelsResponseSchema = Schema.Struct({
  items: Schema.Array(ApplicationLabelSchema),
})

export const AddApplicationNoteResponseSchema = Schema.Struct({
  note: ApplicationNoteSchema,
  replayed: Schema.Boolean,
})

export type AddApplicationNoteResponse = Schema.Schema.Type<
  typeof AddApplicationNoteResponseSchema
>

export const ApplicationAnnotationsResponseSchema = Schema.Struct({
  labels: Schema.Array(ApplicationLabelSchema),
  notes: Schema.Array(ApplicationNoteSchema),
})

export type ApplicationAnnotationsResponse = Schema.Schema.Type<
  typeof ApplicationAnnotationsResponseSchema
>

export const CreateCampaignCaptureResponseSchema = Schema.Struct({
  application: ApplicationSchema,
  capture: CampaignCaptureSchema,
  replayed: Schema.Boolean,
})

export type CreateCampaignCaptureResponse = Schema.Schema.Type<
  typeof CreateCampaignCaptureResponseSchema
>

export const AppendApplicationEventResponseSchema = Schema.Struct({
  application: ApplicationSchema,
  event: ApplicationEventSchema,
  replayed: Schema.Boolean,
})

export type AppendApplicationEventResponse = Schema.Schema.Type<
  typeof AppendApplicationEventResponseSchema
>

export const ListApplicationCapturesResponseSchema = Schema.Struct({
  items: Schema.Array(CampaignCaptureSchema),
})

export type ListApplicationCapturesResponse = Schema.Schema.Type<
  typeof ListApplicationCapturesResponseSchema
>

export const ListApplicationEventsResponseSchema = Schema.Struct({
  items: Schema.Array(ApplicationEventSchema),
})

export type ListApplicationEventsResponse = Schema.Schema.Type<
  typeof ListApplicationEventsResponseSchema
>

export const ListApplicationCompensationsQuerySchema = Schema.Struct({
  currency: Schema.optional(CurrencyCodeSchema),
})

export type ListApplicationCompensationsQuery = Schema.Schema.Type<
  typeof ListApplicationCompensationsQuerySchema
>

export const ConvertedCompensationSchema = Schema.Struct({
  currencyCode: CurrencyCodeSchema,
  minimumMinor: Schema.NullOr(Schema.Int),
  maximumMinor: Schema.NullOr(Schema.Int),
  rate: Schema.Number.pipe(Schema.check(Schema.isGreaterThan(0))),
  provider: NonEmptyString,
  observedAt: UtcIsoTimestampSchema,
})

export type ConvertedCompensation = Schema.Schema.Type<
  typeof ConvertedCompensationSchema
>

export const ApplicationCompensationResponseItemSchema = Schema.Struct({
  original: ApplicationCompensationSchema,
  conversion: Schema.NullOr(ConvertedCompensationSchema),
})

export type ApplicationCompensationResponseItem = Schema.Schema.Type<
  typeof ApplicationCompensationResponseItemSchema
>

export const ListApplicationCompensationsResponseSchema = Schema.Struct({
  items: Schema.Array(ApplicationCompensationResponseItemSchema),
})

export type ListApplicationCompensationsResponse = Schema.Schema.Type<
  typeof ListApplicationCompensationsResponseSchema
>

export const ListEventsResponseSchema = Schema.Struct({
  items: Schema.Array(ApplicationEventSchema),
  ...RevisionPageFields,
})

export type ListEventsResponse = Schema.Schema.Type<
  typeof ListEventsResponseSchema
>

export const HealthResponseSchema = Schema.Struct({ ok: Schema.Boolean })

export const DeleteApplicationResponseSchema = HttpApiSchema.NoContent
