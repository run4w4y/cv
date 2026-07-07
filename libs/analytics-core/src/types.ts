import type { ANALYTICS_DASHBOARD_SCHEMA } from './constants'
import type { Locale } from './locale'

export type AnalyticsDashboardSchema = typeof ANALYTICS_DASHBOARD_SCHEMA

export type AnalyticsGranularity = 'day' | 'hour'

export type AnalyticsTotals = {
  pageViews: number
  visits: number
  visitors: number
}

export type AnalyticsSeriesPoint = {
  at: string
  pageViews: number
  visits: number
  visitors: number
}

export type AnalyticsPathKind = 'audience' | 'public' | 'other'

export type AnalyticsDimensionCounts = Record<string, number>

export type AnalyticsPathRecord = {
  audienceId?: string
  countries: AnalyticsDimensionCounts
  devices: AnalyticsDimensionCounts
  kind: AnalyticsPathKind
  locale?: Locale
  path: string
  profileId?: string
  referrers: AnalyticsDimensionCounts
  series: AnalyticsSeriesPoint[]
  totals: AnalyticsTotals
}

export type AnalyticsAudienceMetadata = {
  archived?: boolean
  company?: string
  createdAt?: string
  label?: string
  locale?: Locale
  notes?: string
  pdfExportedAt?: string
  qrVerifiedAt?: string
  role?: string
  stage?: string
  stacks?: string[]
  variant?: string
}

export type AnalyticsAudienceRecord = {
  audienceId: string
  firstSeen?: string
  lastSeen?: string
  locale: Locale
  metadata?: AnalyticsAudienceMetadata
  path: string
  profileId?: string
  series: AnalyticsSeriesPoint[]
  totals: AnalyticsTotals
}

export type AnalyticsDashboardData = {
  audiences: AnalyticsAudienceRecord[]
  generatedAt: string
  paths: AnalyticsPathRecord[]
  range: {
    from: string
    granularity: AnalyticsGranularity
    to: string
  }
  schema: AnalyticsDashboardSchema
  summary: {
    activeAudiences: number
    audienceViews: number
    publicViews: number
    zeroVisitAudiences: number
  }
  version: 1
}

export type RawAnalyticsInput = unknown
