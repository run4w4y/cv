import { Schema } from 'effect'

export const HealthResponseSchema = Schema.Struct({
  ok: Schema.Boolean,
})

export const AnalyticsConnectorQuerySchema = Schema.Struct({
  from: Schema.optional(Schema.String),
  host: Schema.optional(Schema.String),
  to: Schema.optional(Schema.String),
})

export type AnalyticsConnectorQuery = Schema.Schema.Type<
  typeof AnalyticsConnectorQuerySchema
>

export const VariableRowSchema = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
})

export type VariableRow = Schema.Schema.Type<typeof VariableRowSchema>

export const GrafanaSummaryRowSchema = Schema.Struct({
  active_audiences: Schema.Number,
  audience_views: Schema.Number,
  generated_at: Schema.String,
  public_views: Schema.Number,
  range_from: Schema.String,
  range_to: Schema.String,
  zero_visit_audiences: Schema.Number,
})

const audienceBaseFields = {
  audience_id: Schema.String,
  company: Schema.String,
  label: Schema.String,
  locale: Schema.String,
  path: Schema.String,
  profile_id: Schema.String,
  role: Schema.String,
  stacks: Schema.String,
  stage: Schema.String,
  variant: Schema.String,
}

export const GrafanaAudienceRowSchema = Schema.Struct({
  ...audienceBaseFields,
  archived: Schema.Boolean,
  created_at: Schema.String,
  first_seen: Schema.String,
  last_seen: Schema.String,
  page_views: Schema.Number,
  pdf_exported_at: Schema.String,
  qr_verified_at: Schema.String,
  visits: Schema.Number,
})

export const GrafanaAudienceDailyRowSchema = Schema.Struct({
  ...audienceBaseFields,
  page_views: Schema.Number,
  time: Schema.String,
  visits: Schema.Number,
})

export const GrafanaPathRowSchema = Schema.Struct({
  audience_id: Schema.String,
  kind: Schema.String,
  locale: Schema.String,
  page_views: Schema.Number,
  path: Schema.String,
  profile_id: Schema.String,
  top_country: Schema.String,
  top_referrer: Schema.String,
  visits: Schema.Number,
})

export const GrafanaDimensionRowSchema = Schema.Struct({
  audience_id: Schema.String,
  dimension: Schema.Literals(['country', 'device', 'referrer', 'stack']),
  label: Schema.String,
  locale: Schema.String,
  path: Schema.String,
  profile_id: Schema.String,
  value: Schema.Number,
})

export const GrafanaTableSchemas = {
  audienceDaily: Schema.Array(GrafanaAudienceDailyRowSchema),
  audienceDimensions: Schema.Array(GrafanaDimensionRowSchema),
  audiences: Schema.Array(GrafanaAudienceRowSchema),
  paths: Schema.Array(GrafanaPathRowSchema),
  summary: Schema.Array(GrafanaSummaryRowSchema),
} as const

export const GrafanaAnalyticsTablesSchema = Schema.Struct({
  audienceDaily: Schema.mutable(GrafanaTableSchemas.audienceDaily),
  audienceDimensions: Schema.mutable(GrafanaTableSchemas.audienceDimensions),
  audiences: Schema.mutable(GrafanaTableSchemas.audiences),
  paths: Schema.mutable(GrafanaTableSchemas.paths),
  summary: Schema.mutable(GrafanaTableSchemas.summary),
})

export const VariableRowsSchema = Schema.Array(VariableRowSchema)
