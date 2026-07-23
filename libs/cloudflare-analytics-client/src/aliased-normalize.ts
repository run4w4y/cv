import type { AnalyticsData } from './schemas'
import type { AliasedPathData, PathAlias, Range } from './types'

type Totals = { pageViews: number; visits: number }

type MutableRecord = {
  countries: Record<string, number>
  key: string
  series: Map<string, Totals>
  totals: Totals
}

const addTotals = (target: Totals, source: Totals): void => {
  target.pageViews += source.pageViews
  target.visits += source.visits
}

const analyticsRows = (payload: AnalyticsData) =>
  payload.viewer.zones.flatMap(({ dailyPaths }) => dailyPaths)

const sortedCounts = (counts: Readonly<Record<string, number>>) =>
  Object.fromEntries(
    Object.entries(counts).sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        rightValue - leftValue || leftKey.localeCompare(rightKey)
    )
  )

export const normalizeAliasedPaths = (
  payloads: readonly AnalyticsData[],
  range: Range,
  aliases: ReadonlyArray<PathAlias>,
  generatedAt: string
): AliasedPathData => {
  const records = aliases.map(
    ({ key }): MutableRecord => ({
      countries: {},
      key,
      series: new Map(),
      totals: { pageViews: 0, visits: 0 },
    })
  )
  const recordByPath = new Map(
    aliases.map(({ path }, index) => [path, records[index]])
  )

  for (const row of payloads.flatMap(analyticsRows)) {
    const record = recordByPath.get(row.dimensions.clientRequestPath)
    if (!record) continue

    const totals = { pageViews: row.count, visits: row.sum.visits }
    addTotals(record.totals, totals)

    const at = row.dimensions.datetimeDay
    const point = record.series.get(at) ?? { pageViews: 0, visits: 0 }
    addTotals(point, totals)
    record.series.set(at, point)

    const country = row.dimensions.clientCountryName
    if (totals.visits > 0) {
      record.countries[country] =
        (record.countries[country] ?? 0) + totals.visits
    }
  }

  return {
    generatedAt,
    range: { from: range.from, granularity: 'day', to: range.to },
    records: records.map((record) => ({
      countries: sortedCounts(record.countries),
      key: record.key,
      series: [...record.series.entries()]
        .map(([at, totals]) => ({ at, ...totals }))
        .sort((left, right) => left.at.localeCompare(right.at)),
      totals: record.totals,
    })),
  }
}
