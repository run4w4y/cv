import type { AnalyticsDashboardData } from '@cv/analytics-core'

export type GrafanaSummaryRow = {
  active_audiences: number
  audience_views: number
  generated_at: string
  public_views: number
  range_from: string
  range_to: string
  zero_visit_audiences: number
}

export type GrafanaAudienceRow = {
  archived: boolean
  audience_id: string
  company: string
  created_at: string
  first_seen: string
  label: string
  last_seen: string
  locale: string
  page_views: number
  path: string
  pdf_exported_at: string
  profile_id: string
  qr_verified_at: string
  role: string
  stacks: string
  stage: string
  variant: string
  visits: number
}

export type GrafanaAudienceDailyRow = {
  audience_id: string
  company: string
  label: string
  locale: string
  page_views: number
  path: string
  profile_id: string
  role: string
  stacks: string
  stage: string
  time: string
  variant: string
  visits: number
}

export type GrafanaPathRow = {
  audience_id: string
  kind: string
  locale: string
  page_views: number
  path: string
  profile_id: string
  top_country: string
  top_referrer: string
  visits: number
}

export type GrafanaDimensionRow = {
  audience_id: string
  dimension: 'country' | 'device' | 'referrer' | 'stack'
  label: string
  locale: string
  path: string
  profile_id: string
  value: number
}

export type GrafanaAnalyticsTables = {
  audienceDaily: GrafanaAudienceDailyRow[]
  audienceDimensions: GrafanaDimensionRow[]
  audiences: GrafanaAudienceRow[]
  paths: GrafanaPathRow[]
  summary: GrafanaSummaryRow[]
}

export type GrafanaAnalyticsTableName = keyof GrafanaAnalyticsTables

export type GrafanaAnalyticsDashboardData = AnalyticsDashboardData
