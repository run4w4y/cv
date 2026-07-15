import {
  type Application,
  type ApplicationCompensation,
  ApplicationCompensationSchema,
  type ApplicationEvent,
  ApplicationEventSchema,
  type ApplicationLabel,
  ApplicationLabelSchema,
  type ApplicationListingCheck,
  ApplicationListingCheckSchema,
  type ApplicationNote,
  ApplicationNoteSchema,
  ApplicationSchema,
  type ApplicationStatus,
  ApplicationStatusSchema,
  type CampaignCapture,
  CampaignCaptureSchema,
  CurrencyCodeSchema,
  type ListingCheckRun,
  ListingCheckRunSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
  type PersonalPriority,
  PersonalPrioritySchema,
  type TargetStage,
  TargetStageSchema,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import {
  ApplicationListItemSchema,
  RegistryEventListItemSchema,
} from '@cv/application-registry-entity/query'

export {
  type ApplicationListItem,
  ApplicationListItemSchema,
  type RegistryEventListItem,
  RegistryEventListItemSchema,
} from '@cv/application-registry-entity/query'

import {
  CursorPageInfoSchema,
  queryPageSchema,
} from '@cv/drizzle-query-effect/schema'
import { Schema } from 'effect'
import { HttpApiSchema } from 'effect/unstable/httpapi'

export type {
  AddApplicationNoteCommand as AddApplicationNoteRequest,
  AppendApplicationEventCommand as AppendApplicationEventRequest,
  CreateCampaignCaptureCommand as CreateCampaignCaptureRequest,
  DeleteApplicationQuery,
  ListApplicationsQuery,
  ListEventsQuery,
  PatchApplicationCommand as PatchApplicationRequest,
  RegistryApplicationInput as UpsertApplicationRequest,
  RegistryApplicationInput as CreateApplicationRequest,
  SubmitListingCheckFindingsCommand as SubmitListingCheckFindingsRequest,
} from './commands'
export {
  AddApplicationNoteCommandSchema as AddApplicationNoteRequestSchema,
  AppendApplicationEventCommandSchema as AppendApplicationEventRequestSchema,
  CreateCampaignCaptureCommandSchema as CreateCampaignCaptureRequestSchema,
  DeleteApplicationQuerySchema,
  ListApplicationsQuerySchema,
  ListEventsQuerySchema,
  PaginationSizeSchema,
  PatchApplicationCommandSchema as PatchApplicationRequestSchema,
  RegistryApplicationInputSchema as UpsertApplicationRequestSchema,
  RegistryApplicationInputSchema as CreateApplicationRequestSchema,
  SubmitListingCheckFindingsCommandSchema as SubmitListingCheckFindingsRequestSchema,
} from './commands'

export const ApplicationIdentifierParamsSchema = Schema.Struct({
  id: NonEmptyString,
})

export const ListingCheckRunIdentifierParamsSchema = Schema.Struct({
  id: NonEmptyString,
})

/** Standard cursor-page response returned by application listing. */
export const ListApplicationsResponseSchema = queryPageSchema(
  ApplicationListItemSchema,
  CursorPageInfoSchema
)

export type ListApplicationsResponse = Schema.Schema.Type<
  typeof ListApplicationsResponseSchema
>

export type ApplicationFacetsResponse = {
  readonly applicationStatuses: readonly ApplicationStatus[]
  readonly companies: readonly string[]
  readonly labels: readonly string[]
  readonly personalPriorities: readonly PersonalPriority[]
  readonly targetStages: readonly TargetStage[]
}

export const ApplicationFacetsResponseSchema: Schema.Codec<ApplicationFacetsResponse> =
  Schema.revealCodec(
    Schema.Struct({
      applicationStatuses: Schema.Array(ApplicationStatusSchema),
      companies: Schema.Array(ApplicationSchema.fields.company),
      labels: Schema.Array(NonEmptyString),
      personalPriorities: Schema.Array(PersonalPrioritySchema),
      targetStages: Schema.Array(TargetStageSchema),
    })
  )

export const ReplaceApplicationLabelsRequestSchema = Schema.Struct({
  labels: Schema.Array(NonEmptyString),
})

export type ReplaceApplicationLabelsRequest = Schema.Schema.Type<
  typeof ReplaceApplicationLabelsRequestSchema
>

export type ListApplicationLabelsResponse = {
  readonly items: readonly ApplicationLabel[]
}

export const ListApplicationLabelsResponseSchema: Schema.Codec<ListApplicationLabelsResponse> =
  Schema.revealCodec(
    Schema.Struct({ items: Schema.Array(ApplicationLabelSchema) })
  )

export type AddApplicationNoteResponse = {
  readonly note: ApplicationNote
  readonly replayed: boolean
}

export const AddApplicationNoteResponseSchema: Schema.Codec<AddApplicationNoteResponse> =
  Schema.revealCodec(
    Schema.Struct({
      note: ApplicationNoteSchema,
      replayed: Schema.Boolean,
    })
  )

export type ApplicationAnnotationsResponse = {
  readonly labels: readonly ApplicationLabel[]
  readonly notes: readonly ApplicationNote[]
}

export const ApplicationAnnotationsResponseSchema: Schema.Codec<ApplicationAnnotationsResponse> =
  Schema.revealCodec(
    Schema.Struct({
      labels: Schema.Array(ApplicationLabelSchema),
      notes: Schema.Array(ApplicationNoteSchema),
    })
  )

export type CreateCampaignCaptureResponse = {
  readonly application: Application
  readonly capture: CampaignCapture
  readonly replayed: boolean
}

export const CreateCampaignCaptureResponseSchema: Schema.Codec<CreateCampaignCaptureResponse> =
  Schema.revealCodec(
    Schema.Struct({
      application: ApplicationSchema,
      capture: CampaignCaptureSchema,
      replayed: Schema.Boolean,
    })
  )

export type AppendApplicationEventResponse = {
  readonly application: Application
  readonly event: ApplicationEvent
  readonly replayed: boolean
}

export const AppendApplicationEventResponseSchema: Schema.Codec<AppendApplicationEventResponse> =
  Schema.revealCodec(
    Schema.Struct({
      application: ApplicationSchema,
      event: ApplicationEventSchema,
      replayed: Schema.Boolean,
    })
  )

export type ListApplicationCapturesResponse = {
  readonly items: readonly CampaignCapture[]
}

export const ListApplicationCapturesResponseSchema: Schema.Codec<ListApplicationCapturesResponse> =
  Schema.revealCodec(
    Schema.Struct({ items: Schema.Array(CampaignCaptureSchema) })
  )

export type ListApplicationListingChecksResponse = {
  readonly items: readonly ApplicationListingCheck[]
}

export const ListApplicationListingChecksResponseSchema: Schema.Codec<ListApplicationListingChecksResponse> =
  Schema.revealCodec(
    Schema.Struct({ items: Schema.Array(ApplicationListingCheckSchema) })
  )

export type SubmitListingCheckFindingsResponse = {
  readonly archivedCount: number
  readonly checks: readonly ApplicationListingCheck[]
  readonly rejected: readonly {
    readonly applicationId: string
    readonly message: string
  }[]
  readonly replayedCount: number
  readonly run: ListingCheckRun
}

export const SubmitListingCheckFindingsResponseSchema: Schema.Codec<SubmitListingCheckFindingsResponse> =
  Schema.revealCodec(
    Schema.Struct({
      archivedCount: Schema.Int.pipe(
        Schema.check(Schema.isGreaterThanOrEqualTo(0))
      ),
      checks: Schema.Array(ApplicationListingCheckSchema),
      rejected: Schema.Array(
        Schema.Struct({
          applicationId: NonEmptyString,
          message: NonEmptyString,
        })
      ),
      replayedCount: Schema.Int.pipe(
        Schema.check(Schema.isGreaterThanOrEqualTo(0))
      ),
      run: ListingCheckRunSchema,
    })
  )

export type ListApplicationEventsResponse = {
  readonly items: readonly ApplicationEvent[]
}

export const ListApplicationEventsResponseSchema: Schema.Codec<ListApplicationEventsResponse> =
  Schema.revealCodec(
    Schema.Struct({ items: Schema.Array(ApplicationEventSchema) })
  )

export const ListApplicationCompensationsQuerySchema = Schema.Struct({
  currency: Schema.optional(CurrencyCodeSchema),
})

export type ListApplicationCompensationsQuery = Schema.Schema.Type<
  typeof ListApplicationCompensationsQuerySchema
>

export type ConvertedCompensation = {
  readonly currencyCode: string
  readonly minimumMinor: number | null
  readonly maximumMinor: number | null
  readonly rate: number
  readonly provider: string
  readonly observedAt: string
}

export const ConvertedCompensationSchema: Schema.Codec<ConvertedCompensation> =
  Schema.revealCodec(
    Schema.Struct({
      currencyCode: CurrencyCodeSchema,
      minimumMinor: Schema.NullOr(Schema.Int),
      maximumMinor: Schema.NullOr(Schema.Int),
      rate: Schema.Number.pipe(Schema.check(Schema.isGreaterThan(0))),
      provider: NonEmptyString,
      observedAt: UtcIsoTimestampSchema,
    })
  )

export type ApplicationCompensationResponseItem = {
  readonly original: ApplicationCompensation
  readonly conversion: ConvertedCompensation | null
}

export const ApplicationCompensationResponseItemSchema: Schema.Codec<ApplicationCompensationResponseItem> =
  Schema.revealCodec(
    Schema.Struct({
      original: ApplicationCompensationSchema,
      conversion: Schema.NullOr(ConvertedCompensationSchema),
    })
  )

export type ListApplicationCompensationsResponse = {
  readonly items: readonly ApplicationCompensationResponseItem[]
}

export const ListApplicationCompensationsResponseSchema: Schema.Codec<ListApplicationCompensationsResponse> =
  Schema.revealCodec(
    Schema.Struct({
      items: Schema.Array(ApplicationCompensationResponseItemSchema),
    })
  )

/** Standard cursor-page response returned by registry-wide event listing. */
export const ListEventsResponseSchema = queryPageSchema(
  RegistryEventListItemSchema,
  CursorPageInfoSchema
)

export type ListEventsResponse = Schema.Schema.Type<
  typeof ListEventsResponseSchema
>

export const HealthResponseSchema = Schema.Struct({ ok: Schema.Boolean })
export type HealthResponse = Schema.Schema.Type<typeof HealthResponseSchema>

export const DeleteApplicationResponseSchema = HttpApiSchema.NoContent
