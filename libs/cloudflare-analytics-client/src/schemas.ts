import { Schema } from 'effect'

import type { DatasetLimits } from './types'

const NonNegativeInteger = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

const PositiveInteger = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(1))
)

const AnalyticsDate = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u)),
  Schema.check(
    Schema.makeFilter((value: string) => {
      const timestamp = Date.parse(`${value}T00:00:00.000Z`)

      return Number.isFinite(timestamp) &&
        new Date(timestamp).toISOString().slice(0, 10) === value
        ? true
        : 'Cloudflare analytics dates must be valid calendar dates.'
    })
  )
)

export const GraphqlErrorSchema = Schema.Struct({
  message: Schema.Trimmed.pipe(Schema.check(Schema.isNonEmpty())),
})

export interface GraphqlError
  extends Schema.Schema.Type<typeof GraphqlErrorSchema> {}

export type GraphqlEnvelope<Data> =
  | {
      readonly data: Data
      readonly errors: null
    }
  | {
      readonly data?: unknown
      readonly errors: readonly [GraphqlError, ...GraphqlError[]]
    }

const GraphqlFailureSchema = Schema.Struct({
  data: Schema.optionalKey(Schema.Unknown),
  errors: Schema.NonEmptyArray(GraphqlErrorSchema),
})

export const LimitsDataSchema = Schema.Struct({
  viewer: Schema.Struct({
    zones: Schema.NonEmptyArray(
      Schema.Struct({
        settings: Schema.Struct({
          httpRequestsAdaptiveGroups: Schema.Struct({
            enabled: Schema.Literal(true),
            maxDuration: PositiveInteger,
            maxPageSize: PositiveInteger,
            notOlderThan: PositiveInteger,
          }),
        }),
      })
    ),
  }),
})

export interface LimitsData
  extends Schema.Schema.Type<typeof LimitsDataSchema> {}

export const LimitsEnvelopeSchema = Schema.Union([
  Schema.Struct({
    data: LimitsDataSchema,
    errors: Schema.Null,
  }),
  GraphqlFailureSchema,
])

export const datasetLimitsFromData = (data: LimitsData): DatasetLimits => {
  const settings = data.viewer.zones[0].settings.httpRequestsAdaptiveGroups
  const secondMs = 1_000

  return {
    maxDurationMs: settings.maxDuration * secondMs,
    maxPageSize: settings.maxPageSize,
    retentionMs: settings.notOlderThan * secondMs,
  }
}

export const AnalyticsRowSchema = Schema.Struct({
  count: NonNegativeInteger,
  dimensions: Schema.Struct({
    clientCountryName: Schema.NonEmptyString,
    clientRequestPath: Schema.NonEmptyString,
    datetimeDay: AnalyticsDate,
  }),
  sum: Schema.Struct({
    visits: NonNegativeInteger,
  }),
})

export interface AnalyticsRow
  extends Schema.Schema.Type<typeof AnalyticsRowSchema> {}

export const AnalyticsDataSchema = Schema.Struct({
  viewer: Schema.Struct({
    zones: Schema.NonEmptyArray(
      Schema.Struct({
        dailyPaths: Schema.Array(AnalyticsRowSchema),
      })
    ),
  }),
})

export interface AnalyticsData
  extends Schema.Schema.Type<typeof AnalyticsDataSchema> {}

export const AnalyticsEnvelopeSchema = Schema.Union([
  Schema.Struct({
    data: AnalyticsDataSchema,
    errors: Schema.Null,
  }),
  GraphqlFailureSchema,
])
