import type {
  AnalyticsAudienceRecord,
  AnalyticsDashboardData,
  AnalyticsDimensionCounts,
  AnalyticsPathRecord,
  AnalyticsSeriesPoint,
} from '@cv/analytics-core'

import { assertGrafanaRowsSafe } from './safety'
import type {
  GrafanaAnalyticsTables,
  GrafanaAudienceDailyRow,
  GrafanaAudienceRow,
  GrafanaDimensionRow,
  GrafanaPathRow,
  GrafanaSummaryRow,
} from './types'

const empty = ''

const joinList = (value: readonly string[] | undefined) =>
  value?.join(', ') ?? empty

const audienceCompany = (audience: AnalyticsAudienceRecord) =>
  audience.metadata?.company ?? audience.metadata?.label ?? audience.audienceId

const audienceStage = (audience: AnalyticsAudienceRecord) =>
  audience.metadata?.stage ??
  (audience.totals.pageViews > 0 ? 'viewed' : 'no visits')

const firstDimension = (counts: AnalyticsDimensionCounts) =>
  Object.entries(counts)[0]?.[0] ?? empty

const audienceBase = (audience: AnalyticsAudienceRecord) => ({
  audience_id: audience.audienceId,
  company: audienceCompany(audience),
  label: audience.metadata?.label ?? empty,
  locale: audience.locale,
  path: audience.path,
  profile_id: audience.profileId ?? empty,
  role: audience.metadata?.role ?? empty,
  stacks: joinList(audience.metadata?.stacks),
  stage: audienceStage(audience),
  variant: audience.metadata?.variant ?? empty,
})

const summaryRows = (data: AnalyticsDashboardData): GrafanaSummaryRow[] => [
  {
    active_audiences: data.summary.activeAudiences,
    audience_views: data.summary.audienceViews,
    generated_at: data.generatedAt,
    public_views: data.summary.publicViews,
    range_from: data.range.from,
    range_to: data.range.to,
    zero_visit_audiences: data.summary.zeroVisitAudiences,
  },
]

const audienceRows = (
  audiences: AnalyticsAudienceRecord[]
): GrafanaAudienceRow[] =>
  audiences.map((audience) => ({
    ...audienceBase(audience),
    archived: Boolean(audience.metadata?.archived),
    created_at: audience.metadata?.createdAt ?? empty,
    first_seen: audience.firstSeen ?? empty,
    last_seen: audience.lastSeen ?? empty,
    page_views: audience.totals.pageViews,
    pdf_exported_at: audience.metadata?.pdfExportedAt ?? empty,
    qr_verified_at: audience.metadata?.qrVerifiedAt ?? empty,
    visits: audience.totals.visits,
  }))

const audienceDailyRow = (
  audience: AnalyticsAudienceRecord,
  point: AnalyticsSeriesPoint
): GrafanaAudienceDailyRow => ({
  ...audienceBase(audience),
  page_views: point.pageViews,
  time: point.at,
  visits: point.visits,
})

const audienceDailyRows = (
  audiences: AnalyticsAudienceRecord[]
): GrafanaAudienceDailyRow[] =>
  audiences.flatMap((audience) =>
    audience.series.map((point) => audienceDailyRow(audience, point))
  )

const pathRows = (paths: AnalyticsPathRecord[]): GrafanaPathRow[] =>
  paths.map((path) => ({
    audience_id: path.audienceId ?? empty,
    kind: path.kind,
    locale: path.locale ?? empty,
    page_views: path.totals.pageViews,
    path: path.path,
    profile_id: path.profileId ?? empty,
    top_country: firstDimension(path.countries),
    top_referrer: firstDimension(path.referrers),
    visits: path.totals.visits,
  }))

const dimensionRowsForCounts = ({
  audience,
  counts,
  dimension,
}: {
  audience: AnalyticsAudienceRecord
  counts: AnalyticsDimensionCounts
  dimension: GrafanaDimensionRow['dimension']
}) =>
  Object.entries(counts).map(
    ([label, value]): GrafanaDimensionRow => ({
      audience_id: audience.audienceId,
      dimension,
      label,
      locale: audience.locale,
      path: audience.path,
      profile_id: audience.profileId ?? empty,
      value,
    })
  )

const stackRows = (audience: AnalyticsAudienceRecord): GrafanaDimensionRow[] =>
  (audience.metadata?.stacks ?? []).map((stack) => ({
    audience_id: audience.audienceId,
    dimension: 'stack',
    label: stack,
    locale: audience.locale,
    path: audience.path,
    profile_id: audience.profileId ?? empty,
    value: audience.totals.visits,
  }))

const audienceDimensionRows = (
  audiences: AnalyticsAudienceRecord[],
  paths: AnalyticsPathRecord[]
): GrafanaDimensionRow[] => {
  const pathByAudience = new Map(
    paths
      .filter((path) => path.audienceId)
      .map((path) => [`${path.profileId ?? ''}:${path.audienceId}`, path])
  )

  return audiences.flatMap((audience) => {
    const path = pathByAudience.get(
      `${audience.profileId ?? ''}:${audience.audienceId}`
    )

    return [
      ...dimensionRowsForCounts({
        audience,
        counts: path?.countries ?? {},
        dimension: 'country',
      }),
      ...dimensionRowsForCounts({
        audience,
        counts: path?.devices ?? {},
        dimension: 'device',
      }),
      ...dimensionRowsForCounts({
        audience,
        counts: path?.referrers ?? {},
        dimension: 'referrer',
      }),
      ...stackRows(audience),
    ]
  })
}

export const buildGrafanaAnalyticsTables = (data: AnalyticsDashboardData) => {
  const tables = {
    audienceDaily: audienceDailyRows(data.audiences),
    audienceDimensions: audienceDimensionRows(data.audiences, data.paths),
    audiences: audienceRows(data.audiences),
    paths: pathRows(data.paths),
    summary: summaryRows(data),
  } satisfies GrafanaAnalyticsTables

  return assertGrafanaRowsSafe(tables)
}
