import {
  ApplicationSchema,
  ContentEntrySchema,
  CvLinkSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'

export const CvAnalyticsDaysSchema = Schema.Literals([1, 3, 7])

const CvAnalyticsDateSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u)),
  Schema.check(
    Schema.makeFilter((value: string) => {
      const timestamp = Date.parse(`${value}T00:00:00.000Z`)
      return Number.isFinite(timestamp) &&
        new Date(timestamp).toISOString().slice(0, 10) === value
        ? true
        : 'Analytics dates must be valid calendar dates.'
    })
  )
)

export const CvAnalyticsQuerySchema = Schema.Struct({
  days: Schema.optional(
    Schema.NumberFromString.pipe(Schema.decodeTo(CvAnalyticsDaysSchema))
  ),
  from: Schema.optional(CvAnalyticsDateSchema),
  to: Schema.optional(CvAnalyticsDateSchema),
})

export type CvAnalyticsQuery = Schema.Schema.Type<typeof CvAnalyticsQuerySchema>

const NonNegativeInteger = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

export const CvAnalyticsTotalsSchema = Schema.Struct({
  pageViews: NonNegativeInteger,
  visits: NonNegativeInteger,
})

export const CvAnalyticsSeriesPointSchema = Schema.Struct({
  at: CvAnalyticsDateSchema,
  ...CvAnalyticsTotalsSchema.fields,
})

export const CvAnalyticsCountrySchema = Schema.Struct({
  name: NonEmptyString,
  visits: NonNegativeInteger,
})

export const CvAnalyticsItemSchema = Schema.Struct({
  application: Schema.Struct({
    appliedAt: ApplicationSchema.fields.appliedAt,
    applicationStatus: ApplicationSchema.fields.applicationStatus,
    postingUrl: ApplicationSchema.fields.postingUrl,
    company: ApplicationSchema.fields.company,
    createdAt: ApplicationSchema.fields.createdAt,
    id: ApplicationSchema.fields.id,
    listingAvailability: ApplicationSchema.fields.listingAvailability,
    role: ApplicationSchema.fields.role,
  }),
  countries: Schema.Array(CvAnalyticsCountrySchema),
  firstSeenOn: Schema.NullOr(CvAnalyticsDateSchema),
  labels: Schema.Array(NonEmptyString),
  lastSeenOn: Schema.NullOr(CvAnalyticsDateSchema),
  link: Schema.Struct({
    contentEntryId: CvLinkSchema.fields.contentEntryId,
    createdAt: CvLinkSchema.fields.createdAt,
    enabled: CvLinkSchema.fields.enabled,
    id: CvLinkSchema.fields.id,
    locale: ContentEntrySchema.fields.locale,
    updatedAt: CvLinkSchema.fields.updatedAt,
  }),
  series: Schema.Array(CvAnalyticsSeriesPointSchema),
  totals: CvAnalyticsTotalsSchema,
})

export const CvAnalyticsResponseSchema = Schema.Struct({
  availability: Schema.Struct({
    from: CvAnalyticsDateSchema,
    to: CvAnalyticsDateSchema,
  }),
  countries: Schema.Array(CvAnalyticsCountrySchema),
  generatedAt: UtcIsoTimestampSchema,
  items: Schema.Array(CvAnalyticsItemSchema),
  range: Schema.Struct({
    from: UtcIsoTimestampSchema,
    granularity: Schema.Literal('day'),
    to: UtcIsoTimestampSchema,
  }),
  series: Schema.Array(CvAnalyticsSeriesPointSchema),
  summary: Schema.Struct({
    enabledLinks: NonNegativeInteger,
    pageViews: NonNegativeInteger,
    publishedLinks: NonNegativeInteger,
    unviewedLinks: NonNegativeInteger,
    viewedLinks: NonNegativeInteger,
    visits: NonNegativeInteger,
  }),
})

export interface CvAnalyticsResponse
  extends Schema.Schema.Type<typeof CvAnalyticsResponseSchema> {}
