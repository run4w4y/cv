import { ANALYTICS_DASHBOARD_SCHEMA } from './constants'
import {
  incrementDimension,
  readDimension,
  sortDimensionCounts,
} from './dimensions'
import type { Locale } from './locale'
import { addTotals, emptyTotals, readTotalsFromRecord } from './metrics'
import { classifyAnalyticsPath, pathKindOrder } from './path'
import { assertSafeString } from './privacy'
import {
  flattenRawRows,
  readDateFromRecord,
  readPathFromRecord,
} from './raw-input'
import type {
  AnalyticsAudienceRecord,
  AnalyticsDashboardData,
  AnalyticsPathRecord,
  RawAnalyticsInput,
} from './types'

type MutablePathRecord = AnalyticsPathRecord

const compareByPath = (a: AnalyticsPathRecord, b: AnalyticsPathRecord) =>
  (a.locale ?? '').localeCompare(b.locale ?? '') ||
  pathKindOrder(a.kind) - pathKindOrder(b.kind) ||
  a.path.localeCompare(b.path)

const compareByAudience = (
  a: AnalyticsAudienceRecord,
  b: AnalyticsAudienceRecord
) =>
  a.audienceId.localeCompare(b.audienceId) ||
  (a.profileId ?? '').localeCompare(b.profileId ?? '') ||
  a.locale.localeCompare(b.locale)

const sanitizeRows = (
  rows: Record<string, unknown>[],
  options: { from?: string; to?: string } = {}
) => {
  const pathMap = new Map<string, MutablePathRecord>()
  const allDates: string[] = []

  for (const row of rows) {
    const rawPath = readPathFromRecord(row)

    if (!rawPath) {
      continue
    }

    const classification = classifyAnalyticsPath(rawPath)
    const totals = readTotalsFromRecord(row)
    const record: MutablePathRecord =
      pathMap.get(classification.path) ??
      ({
        ...(classification.audienceId
          ? { audienceId: classification.audienceId }
          : {}),
        countries: {},
        devices: {},
        kind: classification.kind,
        ...(classification.locale ? { locale: classification.locale } : {}),
        path: classification.path,
        referrers: {},
        series: [],
        totals: emptyTotals(),
      } satisfies MutablePathRecord)

    addTotals(record.totals, totals)

    const at = readDateFromRecord(row)

    if (at) {
      assertSafeString(at, 'date bucket')
      allDates.push(at)
      record.series.push({ at, ...totals })
    }

    const dimensionWeight = totals.visits || totals.pageViews || 1
    incrementDimension(
      record.referrers,
      readDimension(row, ['refererHost', 'referer', 'referrer']),
      dimensionWeight
    )
    incrementDimension(
      record.countries,
      readDimension(row, ['country', 'clientCountryName', 'countryName']),
      dimensionWeight
    )
    incrementDimension(
      record.devices,
      readDimension(row, ['device', 'deviceType', 'clientDeviceType']),
      dimensionWeight
    )

    pathMap.set(record.path, record)
  }

  const paths = Array.from(pathMap.values())
    .map((record) => ({
      ...record,
      countries: sortDimensionCounts(record.countries),
      devices: sortDimensionCounts(record.devices),
      referrers: sortDimensionCounts(record.referrers),
      series: record.series.sort((a, b) => a.at.localeCompare(b.at)),
    }))
    .sort(compareByPath)
  const audiences = paths
    .filter(
      (
        path
      ): path is AnalyticsPathRecord & {
        audienceId: string
        locale: Locale
      } =>
        path.kind === 'audience' &&
        Boolean(path.audienceId) &&
        Boolean(path.locale)
    )
    .map((path) => ({
      audienceId: path.audienceId,
      firstSeen: path.series.at(0)?.at,
      lastSeen: path.series.at(-1)?.at,
      locale: path.locale,
      path: path.path,
      ...(path.profileId ? { profileId: path.profileId } : {}),
      series: path.series,
      totals: path.totals,
    }))
    .sort(compareByAudience)
  const publicViews = paths
    .filter((path) => path.kind === 'public')
    .reduce((total, path) => total + path.totals.pageViews, 0)
  const audienceViews = audiences.reduce(
    (total, audience) => total + audience.totals.pageViews,
    0
  )
  const sortedDates = allDates.sort()

  return {
    audiences,
    generatedAt: new Date().toISOString(),
    paths,
    range: {
      from: options.from ?? sortedDates[0] ?? new Date(0).toISOString(),
      granularity: 'day',
      to: options.to ?? sortedDates.at(-1) ?? new Date(0).toISOString(),
    },
    schema: ANALYTICS_DASHBOARD_SCHEMA,
    summary: {
      activeAudiences: audiences.filter(
        (audience) => audience.totals.pageViews > 0
      ).length,
      audienceViews,
      publicViews,
      zeroVisitAudiences: audiences.filter(
        (audience) => audience.totals.pageViews === 0
      ).length,
    },
    version: 1,
  } satisfies AnalyticsDashboardData
}

export const sanitizeAnalyticsInput = (
  input: RawAnalyticsInput,
  options: { from?: string; to?: string } = {}
) => sanitizeRows(flattenRawRows(input), options)

export const createEmptyAnalyticsDashboardData = () =>
  ({
    audiences: [],
    generatedAt: new Date(0).toISOString(),
    paths: [],
    range: {
      from: new Date(0).toISOString(),
      granularity: 'day',
      to: new Date(0).toISOString(),
    },
    schema: ANALYTICS_DASHBOARD_SCHEMA,
    summary: {
      activeAudiences: 0,
      audienceViews: 0,
      publicViews: 0,
      zeroVisitAudiences: 0,
    },
    version: 1,
  }) satisfies AnalyticsDashboardData
