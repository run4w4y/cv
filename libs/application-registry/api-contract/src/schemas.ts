import {
  type Application,
  type ApplicationActivity,
  ApplicationActivitySchema,
  type ApplicationCompensation,
  ApplicationCompensationSchema,
  type ApplicationLabel,
  ApplicationLabelSchema,
  type ApplicationListingCheck,
  ApplicationListingCheckSchema,
  type ApplicationNote,
  ApplicationNoteSchema,
  ApplicationSchema,
  type ListingCheckRun,
  ListingCheckRunSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
} from '@cv/application-registry-entity'
import {
  type AnnualCompensation,
  AnnualCompensationSchema,
  ApplicationListItemSchema,
  RegistryActivityListItemSchema,
} from '@cv/application-registry-entity/query'

export {
  type ApplicationListItem,
  ApplicationListItemSchema,
  type RegistryActivityListItem,
  RegistryActivityListItemSchema,
} from '@cv/application-registry-entity/query'

import {
  CursorPageInfoSchema,
  queryPageSchema,
} from '@cv/drizzle-query-effect/schema'
import { Schema } from 'effect'

export type {
  AddApplicationNoteCommand as AddApplicationNoteRequest,
  ListActivitiesQuery,
  ListApplicationsQuery,
  RegistryApplicationInput as CreateApplicationRequest,
  ResolveListingAvailabilityCommand as ResolveListingAvailabilityRequest,
  SubmitListingCheckFindingsCommand as SubmitListingCheckFindingsRequest,
  UpdateApplicationCommand as UpdateApplicationRequest,
} from './commands'
export {
  AddApplicationNoteCommandSchema as AddApplicationNoteRequestSchema,
  IdempotencyHeadersSchema,
  ListActivitiesQuerySchema,
  ListApplicationsQuerySchema,
  PaginationSizeSchema,
  RegistryApplicationInputSchema as CreateApplicationRequestSchema,
  ResolveListingAvailabilityCommandSchema as ResolveListingAvailabilityRequestSchema,
  SubmitListingCheckFindingsCommandSchema as SubmitListingCheckFindingsRequestSchema,
  UpdateApplicationCommandSchema as UpdateApplicationRequestSchema,
} from './commands'

export const ApplicationIdentifierParamsSchema = Schema.Struct({
  id: NonEmptyString,
})

export const ListingCheckRunIdentifierParamsSchema = Schema.Struct({
  id: NonEmptyString,
})

export const ListingCheckRunFindingsParamsSchema = Schema.Struct({
  runId: NonEmptyString,
})

/** Canonical application response used by application read and write routes. */
export const ApplicationResponseSchema: Schema.Codec<Application> =
  Schema.revealCodec(ApplicationSchema)

/** Standard cursor-page response returned by application listing. */
export const ListApplicationsResponseSchema = queryPageSchema(
  ApplicationListItemSchema,
  CursorPageInfoSchema
)

export type ListApplicationsResponse = Schema.Schema.Type<
  typeof ListApplicationsResponseSchema
>

export type ApplicationFacetsResponse = {
  readonly companies: readonly string[]
  readonly labels: readonly string[]
}

export const ApplicationFacetsResponseSchema: Schema.Codec<ApplicationFacetsResponse> =
  Schema.revealCodec(
    Schema.Struct({
      companies: Schema.Array(ApplicationSchema.fields.company),
      labels: Schema.Array(NonEmptyString),
    })
  )

export type UpdateApplicationResponse = {
  readonly annualCompensation: AnnualCompensation | null
  readonly application: Application
  readonly labels: readonly string[]
}

export const UpdateApplicationResponseSchema: Schema.Codec<UpdateApplicationResponse> =
  Schema.revealCodec(
    Schema.Struct({
      annualCompensation: Schema.NullOr(AnnualCompensationSchema),
      application: ApplicationSchema,
      labels: Schema.Array(NonEmptyString),
    })
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

export type ListApplicationListingChecksResponse = {
  readonly items: readonly ApplicationListingCheck[]
}

export const ListApplicationListingChecksResponseSchema: Schema.Codec<ListApplicationListingChecksResponse> =
  Schema.revealCodec(
    Schema.Struct({ items: Schema.Array(ApplicationListingCheckSchema) })
  )

export type ResolveListingAvailabilityResponse = {
  readonly application: Application
  readonly archived: boolean
  readonly check: ApplicationListingCheck
  readonly replayed: boolean
}

export const ResolveListingAvailabilityResponseSchema: Schema.Codec<ResolveListingAvailabilityResponse> =
  Schema.revealCodec(
    Schema.Struct({
      application: ApplicationSchema,
      archived: Schema.Boolean,
      check: ApplicationListingCheckSchema,
      replayed: Schema.Boolean,
    })
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

export type ListApplicationActivitiesResponse = {
  readonly items: readonly ApplicationActivity[]
}

export const ListApplicationActivitiesResponseSchema: Schema.Codec<ListApplicationActivitiesResponse> =
  Schema.revealCodec(
    Schema.Struct({ items: Schema.Array(ApplicationActivitySchema) })
  )

export type ListApplicationCompensationsResponse = {
  readonly items: readonly ApplicationCompensation[]
}

export const ListApplicationCompensationsResponseSchema: Schema.Codec<ListApplicationCompensationsResponse> =
  Schema.revealCodec(
    Schema.Struct({
      items: Schema.Array(ApplicationCompensationSchema),
    })
  )

/** Standard cursor-page response returned by registry-wide activity listing. */
export const ListActivitiesResponseSchema = queryPageSchema(
  RegistryActivityListItemSchema,
  CursorPageInfoSchema
)

export type ListActivitiesResponse = Schema.Schema.Type<
  typeof ListActivitiesResponseSchema
>

export const HealthResponseSchema = Schema.Struct({ ok: Schema.Boolean })
export type HealthResponse = Schema.Schema.Type<typeof HealthResponseSchema>
